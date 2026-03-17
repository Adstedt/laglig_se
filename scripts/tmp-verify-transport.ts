import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const { prisma } = await import('../lib/prisma')

  // Get the legal document
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:588' },
    select: { id: true, title: true, markdown_content: true, full_text: true },
  })

  if (!doc) {
    console.log('Document SFS 2025:588 not found')

    // Try fuzzy search
    const similar = await prisma.legalDocument.findMany({
      where: { document_number: { contains: '2025:588' } },
      select: { id: true, document_number: true, title: true },
    })
    console.log('Similar docs:', similar)

    // Also try searching for hållbarhetskriterier
    const byTitle = await prisma.legalDocument.findMany({
      where: {
        OR: [
          { title: { contains: 'hållbarhetskriterier' } },
          { title: { contains: 'hållbarhet' } },
          { title: { contains: 'bränsle' } },
        ],
      },
      select: { id: true, document_number: true, title: true },
    })
    console.log('Docs about hållbarhet/bränsle:', byTitle)

    return
  }

  console.log('Found:', doc.title)

  const text = doc.full_text || doc.markdown_content || ''
  console.log('Text length:', text.length)

  // Look for § 19 (rapporteringsskyldighet)
  const s19Match = text.match(/19\s*§[\s\S]{0,800}/)
  console.log('\n=== § 19 (rapporteringsskyldighet) ===')
  console.log(s19Match ? s19Match[0].substring(0, 600) : 'NOT FOUND')

  // Look for § 22-24 (kontrollsystem)
  const s22Match = text.match(/22\s*§[\s\S]{0,500}/)
  console.log('\n=== § 22 (kontrollsystem) ===')
  console.log(s22Match ? s22Match[0].substring(0, 400) : 'NOT FOUND')

  const s23Match = text.match(/23\s*§[\s\S]{0,500}/)
  console.log('\n=== § 23 ===')
  console.log(s23Match ? s23Match[0].substring(0, 400) : 'NOT FOUND')

  const s24Match = text.match(/24\s*§[\s\S]{0,500}/)
  console.log('\n=== § 24 ===')
  console.log(s24Match ? s24Match[0].substring(0, 400) : 'NOT FOUND')

  // Look for § 38 (arkivering)
  const s38Match = text.match(/38\s*§[\s\S]{0,400}/)
  console.log('\n=== § 38 (arkivering) ===')
  console.log(s38Match ? s38Match[0].substring(0, 400) : 'NOT FOUND')

  // Look for § 44-45 (rapportering)
  const s44Match = text.match(/44\s*§[\s\S]{0,500}/)
  console.log('\n=== § 44 ===')
  console.log(s44Match ? s44Match[0].substring(0, 400) : 'NOT FOUND')

  const s45Match = text.match(/45\s*§[\s\S]{0,500}/)
  console.log('\n=== § 45 ===')
  console.log(s45Match ? s45Match[0].substring(0, 400) : 'NOT FOUND')

  // Look for specific claims
  console.log('\n\n========== CLAIM VERIFICATION ==========')

  // Claim 1: "200 kubikmeter per år"
  const vol200 = text.match(/200[\s\S]{0,300}/g)
  console.log('\n--- Claim 1: "200 kubikmeter per år" ---')
  if (vol200) {
    vol200.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 250)))
  } else {
    console.log('No mention of "200" found')
  }

  const kubik = text.match(/kubikmeter[\s\S]{0,200}/gi)
  console.log('\nkubikmeter mentions:')
  if (kubik) {
    kubik.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "kubikmeter" found')
  }

  // Claim 2: "2 gigawattimmar per år"
  const gw = text.match(/gigawattimmar[\s\S]{0,200}/gi)
  console.log('\n--- Claim 2: "2 gigawattimmar per år" ---')
  if (gw) {
    gw.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "gigawattimmar" found')
  }

  const gw2 = text.match(/2\s*gigawatt[\s\S]{0,200}/gi)
  console.log('\n"2 gigawatt" mentions:')
  if (gw2) {
    gw2.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No exact "2 gigawatt" match')
  }

  // Claim 3: "Årlig rapportering senast 1 april"
  const april = text.match(/april[\s\S]{0,200}/gi)
  console.log('\n--- Claim 3: "senast 1 april" ---')
  if (april) {
    april.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "april" found')
  }

  const rapportering = text.match(/rapporter[\s\S]{0,200}/gi)
  console.log('\nrapportering mentions:')
  if (rapportering) {
    rapportering
      .slice(0, 5)
      .forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of rapportering found')
  }

  // Claim 4: "Spara underlag i sju år"
  const sju = text.match(/sju\s*år[\s\S]{0,200}/gi)
  console.log('\n--- Claim 4: "sju år" ---')
  if (sju) {
    sju.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "sju år" found')
  }

  const arkiv = text.match(/bevar[\s\S]{0,200}/gi)
  console.log('\nbevara/bevaras mentions:')
  if (arkiv) {
    arkiv
      .slice(0, 3)
      .forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "bevara" found')
  }

  // Claim 5: "kontrollsystem med massbalans och stickprovsrutiner"
  const massbalans = text.match(/massbalans[\s\S]{0,200}/gi)
  console.log('\n--- Claim 5: "massbalans" ---')
  if (massbalans) {
    massbalans
      .slice(0, 3)
      .forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "massbalans" found')
  }

  const stickprov = text.match(/stickprov[\s\S]{0,200}/gi)
  console.log('\nstickprov mentions:')
  if (stickprov) {
    stickprov
      .slice(0, 3)
      .forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "stickprov" found')
  }

  const kontrollsystem = text.match(/kontrollsystem[\s\S]{0,200}/gi)
  console.log('\nkontrollsystem mentions:')
  if (kontrollsystem) {
    kontrollsystem
      .slice(0, 3)
      .forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)))
  } else {
    console.log('No mention of "kontrollsystem" found')
  }

  // Also dump a broader section listing to see what paragraphs exist
  const allParagraphs = text.match(/\d+\s*§/g)
  console.log('\n\n=== All paragraph numbers found ===')
  console.log(allParagraphs ? [...new Set(allParagraphs)].join(', ') : 'None')

  console.log('\n\n=== Total text length ===')
  console.log(text.length, 'characters')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
