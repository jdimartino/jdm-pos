// scripts/sync-categories.js — JDM-POS
// Detecta categorías usadas por products y crea las que falten en categories
// Uso: node scripts/sync-categories.js

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { initializeApp } from 'firebase/app'
import {
    getFirestore, collection, addDoc, serverTimestamp,
    getDocs, query, orderBy,
} from 'firebase/firestore'

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

const COLORS = ['amber', 'orange', 'red', 'sky', 'yellow', 'purple', 'green', 'teal', 'pink', 'indigo', 'lime', 'emerald']

async function main() {
    console.log('🔍 Leyendo productos de Firestore...\n')

    const productsSnap = await getDocs(collection(db, 'products'))
    const productCategories = new Set()
    productsSnap.docs.forEach(d => {
        const cat = d.data().category
        if (cat) productCategories.add(cat)
    })

    console.log(`   Categorías encontradas en products: ${[...productCategories].join(', ')}\n`)

    console.log('📁 Leyendo categorías existentes...\n')

    const catSnap = await getDocs(query(collection(db, 'categories'), orderBy('order')))
    const existingNames = new Set()
    let maxOrder = 0

    catSnap.docs.forEach(d => {
        const data = d.data()
        existingNames.add(data.name)
        if (data.order > maxOrder) maxOrder = data.order
        console.log(`   ✅ ${data.name} (${data.color})`)
    })

    console.log('')

    const missing = [...productCategories].filter(c => !existingNames.has(c))

    if (missing.length === 0) {
        console.log('✅ Todas las categorías ya existen. Nada que hacer.')
        process.exit(0)
    }

    console.log(`⚠️  Categorías faltantes: ${missing.join(', ')}\n`)

    for (let i = 0; i < missing.length; i++) {
        const name = missing[i]
        const color = COLORS[(maxOrder + i) % COLORS.length]
        const order = maxOrder + i + 1

        const ref = await addDoc(collection(db, 'categories'), {
            name,
            color,
            order,
            createdAt: serverTimestamp(),
        })
        console.log(`   ✅ ${name} creada (${color}, orden ${order}) — ${ref.id}`)
    }

    console.log(`\n🎉 ${missing.length} categorías creadas.`)
    process.exit(0)
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
