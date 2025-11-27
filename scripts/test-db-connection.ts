import { prisma } from '../lib/prisma'

async function testConnection() {
  try {
    console.log('Testing database connection...')

    // Test simple query
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connected successfully')

    // Test schema
    const count = await prisma.legalDocument.count()
    console.log(`✅ legal_documents table accessible (${count} records)`)

    const amendmentCount = await prisma.amendment.count()
    console.log(`✅ amendments table accessible (${amendmentCount} records)`)
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
