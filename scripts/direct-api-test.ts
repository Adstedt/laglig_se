#!/usr/bin/env npx tsx

async function testApi() {
  const url =
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=5&sort=publicerad&sortorder=desc'

  console.log('Testing Riksdagen API directly...')
  console.log('URL:', url)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
        Accept: 'application/json',
      },
    })

    console.log('Response status:', response.status)
    console.log(
      'Response headers:',
      Object.fromEntries(response.headers.entries())
    )

    if (!response.ok) {
      console.log('Response not OK')
      return
    }

    const text = await response.text()
    console.log('Response length:', text.length, 'bytes')

    const data = JSON.parse(text)
    console.log('Total documents:', data.dokumentlista['@traffar'])
    console.log('First doc:', data.dokumentlista.dokument?.[0]?.beteckning)
  } catch (error) {
    console.error('Error:', error)
  }
}

testApi()
