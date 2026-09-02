// functions/src/index.ts — JDM POS Telemetry
// Reporte diario privado del desarrollador vía Telegram.

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

const VET_OFFSET_HOURS = -4;

// ─── Telegram ──────────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
        console.error("[Telegram] Faltan credenciales TELEGRAM_TOKEN / TELEGRAM_CHAT_ID.");
        return false;
    }

    const payload = {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const resp = await axios.post(
                `https://api.telegram.org/bot${token}/sendMessage`,
                payload,
            );
            console.log(`[Telegram] Mensaje enviado OK (status ${resp.status}, attempt ${attempt})`);
            return true;
        } catch (e: any) {
            console.error(
                `[Telegram] Intento ${attempt} fallido:`,
                e.response?.data || e.message,
            );
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
    }

    console.error("[Telegram] Fallo definitivo tras 3 intentos.");
    return false;
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Devuelve { start, end, reportDateStr } del día ANTERIOR en hora de Caracas.
 *
 *   start = ayer 00:00:00 VET  → convertido a UTC para Firestore Timestamp
 *   end   = ayer 23:59:59.999 VET → convertido a UTC para Firestore Timestamp
 */
function getYesterdayRange() {
    const now = new Date();

    // "Hoy" en Caracas
    const todayInCaracas = new Date(now.getTime() + VET_OFFSET_HOURS * 3600_000);

    // "Ayer" en Caracas
    const yesterdayInCaracas = new Date(todayInCaracas);
    yesterdayInCaracas.setUTCDate(yesterdayInCaracas.getUTCDate() - 1);

    // Inicio del día (00:00:00.000 VET)
    const startVet = new Date(yesterdayInCaracas);
    startVet.setUTCHours(0, 0, 0, 0);

    // Fin del día (23:59:59.999 VET)
    const endVet = new Date(yesterdayInCaracas);
    endVet.setUTCHours(23, 59, 59, 999);

    // Convertir de vuelta a UTC restando el offset
    const startUtc = new Date(startVet.getTime() - VET_OFFSET_HOURS * 3600_000);
    const endUtc = new Date(endVet.getTime() - VET_OFFSET_HOURS * 3600_000);

    // String YYYY-MM-DD del día que estamos reportando (para reportDate y display)
    const y = yesterdayInCaracas.getUTCFullYear();
    const m = String(yesterdayInCaracas.getUTCMonth() + 1).padStart(2, "0");
    const d = String(yesterdayInCaracas.getUTCDate()).padStart(2, "0");
    const reportDateStr = `${y}-${m}-${d}`;

    // Formato DD/MM/YYYY para el mensaje
    const displayDate = `${d}/${m}/${y}`;

    return { startUtc, endUtc, reportDateStr, displayDate };
}

// ─── Core: Telemetry ───────────────────────────────────────────────────────────

interface OrderData {
    totalUSD: number;
    voided?: boolean;
    createdAt?: admin.firestore.Timestamp;
}

interface ItemData {
    qty: number;
}

async function runDailyTelemetry(skipDuplicateCheck = false): Promise<{
    status: "sent" | "no_sales" | "error" | "duplicate";
    reportDate?: string;
}> {
    const { startUtc, endUtc, reportDateStr, displayDate } = getYesterdayRange();

    console.log(`[Telemetry] Generando reporte para ${reportDateStr} (${displayDate})`);

    // 1. Verificar duplicados
    if (!skipDuplicateCheck) {
        const existingSnap = await db
            .collection("telemetry_reports")
            .where("reportDate", "==", reportDateStr)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            console.log(`[Telemetry] Reporte ${reportDateStr} ya fue enviado. Saltando.`);
            return { status: "duplicate", reportDate: reportDateStr };
        }
    }

    // 2. Consultar órdenes pagadas del día
    let ordersSnap: admin.firestore.QuerySnapshot;
    try {
        ordersSnap = await db
            .collection("orders")
            .where("status", "==", "paid")
            .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startUtc))
            .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endUtc))
            .get();
    } catch (e: any) {
        console.error("[Telemetry] Error consultando órdenes:", e.message);
        await sendTelegram(
            `📊 JDM POS — REPORTE DE USO\nFecha: ${displayDate}\n\n🔴 NO SE PUDO VERIFICAR\n\n_Motivo: Error al consultar Firestore_`,
        );
        return { status: "error", reportDate: reportDateStr };
    }

    // 3. Filtrar voided
    const validOrders = ordersSnap.docs.filter((doc) => {
        const data = doc.data() as OrderData;
        return data.voided !== true;
    });

    // 4. Si no hay ventas
    if (validOrders.length === 0) {
        const msg = [
            `📊 JDM POS — REPORTE DE USO`,
            `Fecha: ${displayDate}`,
            ``,
            `🟡 SIN VENTAS`,
        ].join("\n");

        const sent = await sendTelegram(msg);
        if (sent) {
            await db.collection("telemetry_reports").add({
                reportDate: reportDateStr,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                totalOps: 0,
                totalSold: 0,
                firstOp: null,
                lastOp: null,
                totalUnits: 0,
                status: "no_sales",
            });
        }
        return { status: sent ? "no_sales" : "error", reportDate: reportDateStr };
    }

    // 5. Calcular métricas
    let totalSold = 0;
    let totalUnits = 0;
    let firstOpTime: Date | null = null;
    let lastOpTime: Date | null = null;

    for (const orderDoc of validOrders) {
        const orderData = orderDoc.data() as OrderData;
        totalSold += orderData.totalUSD || 0;

        const createdAt = orderData.createdAt?.toDate();
        if (createdAt) {
            if (!firstOpTime || createdAt < firstOpTime) firstOpTime = createdAt;
            if (!lastOpTime || createdAt > lastOpTime) lastOpTime = createdAt;
        }

        // Sumar unidades de la subcolección items
        try {
            const itemsSnap = await db
                .collection("orders")
                .doc(orderDoc.id)
                .collection("items")
                .get();
            for (const itemDoc of itemsSnap.docs) {
                const itemData = itemDoc.data() as ItemData;
                totalUnits += itemData.qty || 0;
            }
        } catch (e: any) {
            console.error(`[Telemetry] Error leyendo items de orden ${orderDoc.id}:`, e.message);
        }
    }

    // 6. Formatear horas en VET
    function formatTimeVet(date: Date): string {
        const vetDate = new Date(date.getTime() + VET_OFFSET_HOURS * 3600_000);
        const h = String(vetDate.getUTCHours()).padStart(2, "0");
        const min = String(vetDate.getUTCMinutes()).padStart(2, "0");
        return `${h}:${min}`;
    }

    const firstOpStr = firstOpTime ? formatTimeVet(firstOpTime) : "—";
    const lastOpStr = lastOpTime ? formatTimeVet(lastOpTime) : "—";
    const totalSoldStr = `$${totalSold.toFixed(2)}`;

    // 7. Construir mensaje
    const msg = [
        `📊 JDM POS — REPORTE DE USO`,
        `Fecha: ${displayDate}`,
        ``,
        `🟢 ACTIVIDAD DETECTADA`,
        ``,
        `Operaciones: ${validOrders.length}`,
        `Total vendido: ${totalSoldStr}`,
        `Primera operación: ${firstOpStr}`,
        `Última operación: ${lastOpStr}`,
        `Unidades vendidas: ${totalUnits}`,
    ].join("\n");

    // 8. Enviar
    const sent = await sendTelegram(msg);

    // 9. Registrar (solo si se envió correctamente)
    if (sent) {
        await db.collection("telemetry_reports").add({
            reportDate: reportDateStr,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            totalOps: validOrders.length,
            totalSold,
            firstOp: firstOpStr,
            lastOp: lastOpStr,
            totalUnits,
            status: "sent",
        });
    }

    return { status: sent ? "sent" : "error", reportDate: reportDateStr };
}

// ─── Scheduled: 8:00 AM Caracas todos los días ────────────────────────────────

export const dailyTelemetryReport = functions
    .region("europe-west1")
    .runWith({ memory: "128MB", secrets: ["TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID"] })
    .pubsub.schedule("0 8 * * *")
    .timeZone("America/Caracas")
    .onRun(async () => {
        try {
            await runDailyTelemetry(false);
        } catch (e) {
            console.error("Error en dailyTelemetryReport:", e);
        }
    });

// ─── HTTP: Prueba manual ──────────────────────────────────────────────────────

export const testTelemetry = functions
    .region("europe-west1")
    .runWith({ secrets: ["TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID"] })
    .https.onRequest(async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            // Permitir ?date=YYYY-MM-DD para forzar una fecha específica
            const forcedDate = req.query.date as string | undefined;

            if (forcedDate && /^\d{4}-\d{2}-\d{2}$/.test(forcedDate)) {
                // Sobreescribir getYesterdayRange para fecha forzada
                const [y, m, d] = forcedDate.split("-").map(Number);
                const forcedVet = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
                const startUtc = new Date(forcedVet.getTime() - VET_OFFSET_HOURS * 3600_000);
                const endVet = new Date(forcedVet);
                endVet.setUTCHours(23, 59, 59, 999);
                const endUtc = new Date(endVet.getTime() - VET_OFFSET_HOURS * 3600_000);
                const displayDate = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
                const reportDateStr = forcedDate;

                // Verificar duplicados
                const existingSnap = await db
                    .collection("telemetry_reports")
                    .where("reportDate", "==", reportDateStr)
                    .limit(1)
                    .get();
                if (!existingSnap.empty) {
                    res.json({
                        ok: true,
                        skipped: true,
                        reason: "duplicate",
                        reportDate: reportDateStr,
                    });
                    return;
                }

                // Consultar órdenes
                const ordersSnap = await db
                    .collection("orders")
                    .where("status", "==", "paid")
                    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startUtc))
                    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endUtc))
                    .get();

                const validOrders = ordersSnap.docs.filter(
                    (doc) => (doc.data() as OrderData).voided !== true,
                );

                if (validOrders.length === 0) {
                    const msg = [
                        `📊 JDM POS — REPORTE DE USO`,
                        `Fecha: ${displayDate}`,
                        ``,
                        `🟡 SIN VENTAS`,
                    ].join("\n");
                    const sent = await sendTelegram(msg);
                    if (sent) {
                        await db.collection("telemetry_reports").add({
                            reportDate: reportDateStr,
                            sentAt: admin.firestore.FieldValue.serverTimestamp(),
                            totalOps: 0,
                            totalSold: 0,
                            firstOp: null,
                            lastOp: null,
                            totalUnits: 0,
                            status: "no_sales",
                        });
                    }
                    res.json({ ok: sent, status: "no_sales", reportDate: reportDateStr });
                    return;
                }

                let totalSold = 0;
                let totalUnits = 0;
                let firstOpTime: Date | null = null;
                let lastOpTime: Date | null = null;

                for (const orderDoc of validOrders) {
                    const orderData = orderDoc.data() as OrderData;
                    totalSold += orderData.totalUSD || 0;
                    const createdAt = orderData.createdAt?.toDate();
                    if (createdAt) {
                        if (!firstOpTime || createdAt < firstOpTime) firstOpTime = createdAt;
                        if (!lastOpTime || createdAt > lastOpTime) lastOpTime = createdAt;
                    }
                    const itemsSnap = await db
                        .collection("orders")
                        .doc(orderDoc.id)
                        .collection("items")
                        .get();
                    for (const itemDoc of itemsSnap.docs) {
                        totalUnits += (itemDoc.data() as ItemData).qty || 0;
                    }
                }

                function formatTimeVet(date: Date): string {
                    const vetDate = new Date(date.getTime() + VET_OFFSET_HOURS * 3600_000);
                    const h = String(vetDate.getUTCHours()).padStart(2, "0");
                    const min = String(vetDate.getUTCMinutes()).padStart(2, "0");
                    return `${h}:${min}`;
                }

                const msg = [
                    `📊 JDM POS — REPORTE DE USO`,
                    `Fecha: ${displayDate}`,
                    ``,
                    `🟢 ACTIVIDAD DETECTADA`,
                    ``,
                    `Operaciones: ${validOrders.length}`,
                    `Total vendido: $${totalSold.toFixed(2)}`,
                    `Primera operación: ${firstOpTime ? formatTimeVet(firstOpTime) : "—"}`,
                    `Última operación: ${lastOpTime ? formatTimeVet(lastOpTime) : "—"}`,
                    `Unidades vendidas: ${totalUnits}`,
                ].join("\n");

                const sent = await sendTelegram(msg);
                if (sent) {
                    await db.collection("telemetry_reports").add({
                        reportDate: reportDateStr,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        totalOps: validOrders.length,
                        totalSold,
                        firstOp: firstOpTime ? formatTimeVet(firstOpTime) : null,
                        lastOp: lastOpTime ? formatTimeVet(lastOpTime) : null,
                        totalUnits,
                        status: "sent",
                    });
                }
                res.json({ ok: sent, status: "sent", reportDate: reportDateStr });
                return;
            }

            // Sin ?date → usar lógica normal (día anterior)
            const result = await runDailyTelemetry(true);
            res.json({ ok: result.status === "sent", ...result });
        } catch (e: any) {
            console.error("Error en testTelemetry:", e);
            res.status(500).json({ ok: false, error: e.message });
        }
    });
