import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testConnection() {
  console.log('Testing database connection...\n')
  
  // Check critical env vars
  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
    DIRECT_URL: process.env.DIRECT_URL ? '✅ Set' : '❌ Missing',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
  }
  
  console.log('Environment variables:')
  Object.entries(envVars).forEach(([key, status]) => {
    console.log(`  ${key}: ${status}`)
  })
  
  console.log('\nTrying to connect to database...')
  
  const prisma = new PrismaClient()
  
  try {
    // Test connection
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`
    console.log('✅ Database connection successful!')
    console.log('Connected to:', result)
    
    // Test a simple query
    const userCount = await prisma.user.count()
    console.log(`\n✅ Found ${userCount} users in database`)
    
    const workspaceCount = await prisma.workspace.count()
    console.log(`✅ Found ${workspaceCount} workspaces in database`)
    
  } catch (error) {
    console.error('❌ Database connection failed!')
    console.error(error)
    console.log('\nCommon issues:')
    console.log('1. Wrong DATABASE_URL format (should use port 6543)')
    console.log('2. Invalid password or project ID')
    console.log('3. Database not running or accessible')
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
