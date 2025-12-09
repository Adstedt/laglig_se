/**
 * Compare EUR-Lex API counts vs Bulk Download counts
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql';

function sparqlQuery(query) {
  return new Promise((resolve, reject) => {
    const url = SPARQL_ENDPOINT + '?query=' + encodeURIComponent(query) + '&format=application/json';
    https.get(url, { headers: { 'User-Agent': 'Laglig.se/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function countByResourceType(resourceTypeUri) {
  const query = `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT (COUNT(DISTINCT ?work) AS ?count) WHERE {
      ?work cdm:work_has_resource-type <${resourceTypeUri}> .
      ?expr cdm:expression_belongs_to_work ?work .
      ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
    }
  `;
  const result = await sparqlQuery(query);
  return parseInt(result.results.bindings[0]?.count?.value || '0');
}

async function main() {
  console.log('==========================================');
  console.log('EUR-Lex API vs Bulk Download Comparison');
  console.log('==========================================\n');

  // API counts by resource type
  console.log('📡 Querying EUR-Lex SPARQL API...\n');

  const resourceTypes = [
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/REG', name: 'Regulation (REG)', celex: 'R' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/REG_IMPL', name: 'Implementing Reg (REG_IMPL)', celex: 'R' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/REG_DEL', name: 'Delegated Reg (REG_DEL)', celex: 'R' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/DIR', name: 'Directive (DIR)', celex: 'L' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/DIR_IMPL', name: 'Implementing Dir (DIR_IMPL)', celex: 'L' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/DEC', name: 'Decision (DEC)', celex: 'D' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/DEC_IMPL', name: 'Implementing Dec (DEC_IMPL)', celex: 'D' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/RECO', name: 'Recommendation (RECO)', celex: 'H' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/OPIN', name: 'Opinion (OPIN)', celex: 'Q' },
    { uri: 'http://publications.europa.eu/resource/authority/resource-type/AGREE_INTERNATION', name: 'Intl Agreement', celex: 'A' },
  ];

  const apiCounts = {};
  let apiTotal = 0;

  for (const rt of resourceTypes) {
    try {
      const count = await countByResourceType(rt.uri);
      console.log(`  ${rt.name}: ${count.toLocaleString()}`);
      apiCounts[rt.celex] = (apiCounts[rt.celex] || 0) + count;
      apiTotal += count;
    } catch (e) {
      console.log(`  ${rt.name}: ERROR - ${e.message}`);
    }
  }

  console.log('\n📊 API Summary by CELEX type:');
  Object.entries(apiCounts).sort((a,b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count.toLocaleString()}`);
  });
  console.log(`  TOTAL: ${apiTotal.toLocaleString()}`);

  // Bulk download counts
  console.log('\n==========================================');
  console.log('📦 Bulk Download (Metadata folders)...\n');

  const metadataDir = 'c:/Users/audri/Desktop/EUR LEX METADATA';
  const folders = fs.readdirSync(metadataDir);

  const bulkCounts = {};
  let bulkTotal = 0;

  for (const folder of folders) {
    try {
      const rdfPath = path.join(metadataDir, folder, 'tree_non_inferred.rdf');
      const content = fs.readFileSync(rdfPath, 'utf-8');
      const match = content.match(/resource\/celex\/(3\d{4}[A-Z]\d+)/);
      if (match) {
        const celex = match[1];
        const type = celex.match(/3\d{4}([A-Z])/)[1];
        bulkCounts[type] = (bulkCounts[type] || 0) + 1;
        bulkTotal++;
      }
    } catch (e) {}
  }

  console.log('📊 Bulk Summary by CELEX type:');
  Object.entries(bulkCounts).sort((a,b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count.toLocaleString()}`);
  });
  console.log(`  TOTAL: ${bulkTotal.toLocaleString()}`);

  // Comparison
  console.log('\n==========================================');
  console.log('📊 COMPARISON (API vs Bulk)');
  console.log('==========================================\n');

  const allTypes = new Set([...Object.keys(apiCounts), ...Object.keys(bulkCounts)]);
  console.log('Type | API Count | Bulk Count | Difference');
  console.log('-----|-----------|------------|----------');

  for (const type of [...allTypes].sort()) {
    const api = apiCounts[type] || 0;
    const bulk = bulkCounts[type] || 0;
    const diff = api - bulk;
    const sign = diff > 0 ? '+' : '';
    console.log(`  ${type}  |  ${api.toLocaleString().padStart(8)} |  ${bulk.toLocaleString().padStart(8)} | ${sign}${diff.toLocaleString()}`);
  }

  console.log('-----|-----------|------------|----------');
  console.log(`TOTAL|  ${apiTotal.toLocaleString().padStart(8)} |  ${bulkTotal.toLocaleString().padStart(8)} | ${apiTotal > bulkTotal ? '+' : ''}${(apiTotal - bulkTotal).toLocaleString()}`);
}

main().catch(console.error);
