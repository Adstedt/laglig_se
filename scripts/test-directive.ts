/* eslint-disable no-console */
import { fetchDocumentContentViaCellar } from '../lib/external/eurlex'

async function test() {
  console.log('Testing 32020L1057 (Directive)...')
  const content = await fetchDocumentContentViaCellar('32020L1057')
  if (content) {
    console.log('SUCCESS!')
    console.log('HTML bytes:', content.html.length)
    console.log('Text bytes:', content.plainText.length)
  } else {
    console.log('FAILED: no content')
  }
}
test()
