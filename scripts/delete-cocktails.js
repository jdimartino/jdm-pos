// scripts/delete-cocktails.js — JDM-POS
// Elimina productos de cocteles de Firestore (colección: products)
// Uso: node scripts/delete-cocktails.js

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const COCKTAIL_KEYWORDS = [
    'coctel', 'cocktail', 'margarita', 'mojito', 'piña colada', 'pina colada',
    'screwdriver', 'daiquiri', 'paloma', 'moscow mule', 'cosmopolitan',
    'negroni', 'old fashioned', 'manhattan', 'martini', 'caipirinha',
    'caipiroska', 'bloody mary', 'white russian', 'black russian',
    'long island', 'tequila sunrise', 'campari', 'vermouth', 'gin tonic',
    'rum', 'whisky', 'vodka', 'tequila', 'sangría', 'sangria',
    'chicha', 'cerveza', 'beer', 'corona', 'polar', 'sol',
]

const COCKTAIL_CATEGORIES = [
    'coctelería', 'cocteleria', 'cocteles', 'cocktails', 'bebidas alcoholicas',
    'tragos', 'drinks', 'bar',
]

function matchesCocktail(product) {
    const name = (product.name || '').toLowerCase()
    const category = (product.category || '').toLowerCase()

    if (COCKTAIL_CATEGORIES.some(c => category.includes(c))) return true
    if (COCKTAIL_KEYWORDS.some(k => name.includes(k))) return true
    return false
}

function confirm(message) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => {
        rl.question(message, answer => {
            rl.close()
            resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'si' || answer.toLowerCase() === 'y')
        })
    })
}

async function main() {
    console.log('🔍 Buscando cocteles en Firestore...\n')

    const snapshot = await getDocs(collection(db, 'products'))
    const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    console.log(`   Total de productos en la base: ${allProducts.length}\n`)

    const cocktails = allProducts.filter(matchesCocktail)

    if (cocktails.length === 0) {
        console.log('✅ No se encontraron cocteles en la base de datos.')
        process.exit(0)
    }

    console.log(`🍸 Cocteles encontrados (${cocktails.length}):\n`)
    cocktails.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.emoji || '🍸'} ${p.name} — $${p.priceUSD} (${p.category})`)
    })

    console.log('')
    const ok = await confirm('¿Eliminar estos productos? (s/n): ')

    if (!ok) {
        console.log('❌ Operación cancelada.')
        process.exit(0)
    }

    console.log('\n🗑️  Eliminando cocteles...')
    for (const p of cocktails) {
        await deleteDoc(doc(db, 'products', p.id))
        console.log(`   ✅ ${p.emoji || '🍸'} ${p.name} eliminado`)
    }

    console.log(`\n🎉 ${cocktails.length} cocteles eliminados.`)
    process.exit(0)
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
