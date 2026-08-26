// src/components/admin/BusinessSettingsPanel.jsx — JDM-POS
// Panel de configuración del comercio

import { useState, useEffect } from 'react'
import { useBusiness } from '../../context/BusinessContext'
import { saveBusinessSettings } from '../../services/businessService'

const EMPTY = {
    name: '',
    shortName: '',
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    website: '',
    whatsappReceipt: {
        bank: '',
        phone: '',
        id: '',
        holder: '',
    },
}

export default function BusinessSettingsPanel() {
    const { business, loading } = useBusiness()
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        if (business && !loading) {
            setForm({
                name: business.name || '',
                shortName: business.shortName || '',
                phone: business.phone || '',
                email: business.email || '',
                address: business.address || '',
                logoUrl: business.logoUrl || '',
                instagram: business.instagram || '',
                facebook: business.facebook || '',
                tiktok: business.tiktok || '',
                website: business.website || '',
                whatsappReceipt: {
                    bank: business.whatsappReceipt?.bank || '',
                    phone: business.whatsappReceipt?.phone || '',
                    id: business.whatsappReceipt?.id || '',
                    holder: business.whatsappReceipt?.holder || '',
                },
            })
        }
    }, [business, loading])

    const update = (field, value) => {
        setForm(p => ({ ...p, [field]: value }))
        setSaved(false)
    }

    const updateReceipt = (field, value) => {
        setForm(p => ({
            ...p,
            whatsappReceipt: { ...p.whatsappReceipt, [field]: value },
        }))
        setSaved(false)
    }

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        try {
            await saveBusinessSettings(form)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error('Error guardando configuración:', err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-sm">⚙️ Configuración del Comercio</h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all"
                >
                    {saving ? 'Guardando...' : '💾 Guardar'}
                </button>
            </div>

            {saved && (
                <div className="bg-green-500/15 border border-green-500/30 rounded-2xl px-4 py-3 text-green-400 text-sm font-bold text-center">
                    ✅ Configuración guardada
                </div>
            )}

            {/* Información General */}
            <Section title="📋 Información General">
                <Field label="Nombre del comercio" value={form.name} onChange={v => update('name', v)} placeholder="ej. Restaurante El Sabor" />
                <Field label="Nombre corto" value={form.shortName} onChange={v => update('shortName', v)} placeholder="ej. El Sabor" />
                <Field label="Teléfono" value={form.phone} onChange={v => update('phone', v)} placeholder="ej. 0414-XXXXXXX" />
                <Field label="Email" value={form.email} onChange={v => update('email', v)} placeholder="ej. info@elsabor.com" type="email" />
                <Field label="Dirección" value={form.address} onChange={v => update('address', v)} placeholder="ej. Caracas, Venezuela" />
            </Section>

            {/* Branding */}
            <Section title="🎨 Branding">
                <Field label="URL del Logo" value={form.logoUrl} onChange={v => update('logoUrl', v)} placeholder="https://..." />
                {form.logoUrl && (
                    <div className="mt-2 flex justify-center">
                        <img src={form.logoUrl} alt="Logo del comercio" className="h-16 w-16 object-contain rounded-xl border border-white/10" />
                    </div>
                )}
            </Section>

            {/* Redes Sociales */}
            <Section title="📱 Redes Sociales">
                <Field label="Instagram" value={form.instagram} onChange={v => update('instagram', v)} placeholder="ej. @elsabor" />
                <Field label="Facebook" value={form.facebook} onChange={v => update('facebook', v)} placeholder="https://facebook.com/..." />
                <Field label="TikTok" value={form.tiktok} onChange={v => update('tiktok', v)} placeholder="ej. @elsabor" />
                <Field label="Sitio Web" value={form.website} onChange={v => update('website', v)} placeholder="https://..." />
            </Section>

            {/* Datos para Comprobantes WhatsApp */}
            <Section title="💬 Datos para Comprobantes WhatsApp">
                <p className="text-slate-500 text-xs -mt-2 mb-3">Estos datos aparecen en los comprobantes enviados por WhatsApp. No afectan los métodos de pago.</p>
                <Field label="Banco" value={form.whatsappReceipt.bank} onChange={v => updateReceipt('bank', v)} placeholder="ej. Banco de Venezuela" />
                <Field label="Teléfono" value={form.whatsappReceipt.phone} onChange={v => updateReceipt('phone', v)} placeholder="ej. 0414-XXXXXXX" />
                <Field label="Cédula / RIF" value={form.whatsappReceipt.id} onChange={v => updateReceipt('id', v)} placeholder="ej. V-13536210" />
                <Field label="Nombre del titular" value={form.whatsappReceipt.holder} onChange={v => updateReceipt('holder', v)} placeholder="ej. Restaurante El Sabor" />
            </Section>
        </div>
    )
}

function Section({ title, children }) {
    return (
        <div className="bg-[#1E293B] rounded-2xl p-4 border border-white/5 space-y-3">
            <h3 className="text-white font-bold text-sm">{title}</h3>
            {children}
        </div>
    )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
    return (
        <div>
            <label className="label-xs">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="input-field mt-1"
                placeholder={placeholder}
            />
        </div>
    )
}
