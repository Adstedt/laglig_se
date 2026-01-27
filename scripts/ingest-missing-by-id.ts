/* eslint-disable no-console */
/**
 * Ingest Missing SFS Laws by Direct ID Lookup
 *
 * Fetches specific missing SFS laws by constructing their document IDs directly.
 * This bypasses the pagination limit issue by fetching individual documents.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-missing-by-id.ts
 *
 * To get the missing list, first run:
 *   pnpm tsx scripts/find-missing-sfs.ts > missing-sfs.txt
 */

import { prisma } from '../lib/prisma'
import {
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
} from '../lib/external/riksdagen'
import { ContentType, DocumentStatus } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  DELAY_BETWEEN_REQUESTS: 300, // ms between requests
  PROGRESS_LOG_INTERVAL: 50,
  BATCH_SIZE: 100, // Process in batches for better progress tracking
}

// ============================================================================
// Missing SFS Numbers (from find-missing-sfs.ts output)
// ============================================================================

const MISSING_SFS = [
  // Historical "bih." laws (6) - these need special handling
  'SFS 1878:bih. 56 s. 1',
  'SFS 1883:bih. 39 s. 1',
  'SFS 1895:bih. 10 s. 1',
  'SFS 1895:bih. 52 s. 1',
  'SFS 1899:bih. 40 s. 3',
  'SFS 1901:bih. 56 s. 1',
  // 1977 laws (3)
  'SFS 1977:480',
  'SFS 1977:484',
  'SFS 1977:486',
  // 1980 laws (125)
  'SFS 1980:100',
  'SFS 1980:1021',
  'SFS 1980:1024',
  'SFS 1980:1030',
  'SFS 1980:1035',
  'SFS 1980:1068',
  'SFS 1980:1070',
  'SFS 1980:1097',
  'SFS 1980:11',
  'SFS 1980:1102',
  'SFS 1980:1103',
  'SFS 1980:1128',
  'SFS 1980:1131',
  'SFS 1980:1132',
  'SFS 1980:116',
  'SFS 1980:12',
  'SFS 1980:122',
  'SFS 1980:123',
  'SFS 1980:133',
  'SFS 1980:140',
  'SFS 1980:152',
  'SFS 1980:2',
  'SFS 1980:20',
  'SFS 1980:261',
  'SFS 1980:287',
  'SFS 1980:3',
  'SFS 1980:301',
  'SFS 1980:303',
  'SFS 1980:307',
  'SFS 1980:32',
  'SFS 1980:343',
  'SFS 1980:361',
  'SFS 1980:369',
  'SFS 1980:371',
  'SFS 1980:376',
  'SFS 1980:377',
  'SFS 1980:38',
  'SFS 1980:384',
  'SFS 1980:387',
  'SFS 1980:393',
  'SFS 1980:394',
  'SFS 1980:398',
  'SFS 1980:400',
  'SFS 1980:402',
  'SFS 1980:411',
  'SFS 1980:415',
  'SFS 1980:416',
  'SFS 1980:424',
  'SFS 1980:431',
  'SFS 1980:438',
  'SFS 1980:440',
  'SFS 1980:447',
  'SFS 1980:456',
  'SFS 1980:483',
  'SFS 1980:489',
  'SFS 1980:497',
  'SFS 1980:5',
  'SFS 1980:50',
  'SFS 1980:507',
  'SFS 1980:535',
  'SFS 1980:541',
  'SFS 1980:547',
  'SFS 1980:548',
  'SFS 1980:556',
  'SFS 1980:565',
  'SFS 1980:571',
  'SFS 1980:572',
  'SFS 1980:578',
  'SFS 1980:589',
  'SFS 1980:598',
  'SFS 1980:607',
  'SFS 1980:612',
  'SFS 1980:613',
  'SFS 1980:616',
  'SFS 1980:620',
  'SFS 1980:621',
  'SFS 1980:624',
  'SFS 1980:628',
  'SFS 1980:63',
  'SFS 1980:631',
  'SFS 1980:64',
  'SFS 1980:640',
  'SFS 1980:657',
  'SFS 1980:659',
  'SFS 1980:696',
  'SFS 1980:70',
  'SFS 1980:705',
  'SFS 1980:719',
  'SFS 1980:743',
  'SFS 1980:747',
  'SFS 1980:749',
  'SFS 1980:754',
  'SFS 1980:759',
  'SFS 1980:77',
  'SFS 1980:770',
  'SFS 1980:772',
  'SFS 1980:789',
  'SFS 1980:803',
  'SFS 1980:806',
  'SFS 1980:845',
  'SFS 1980:846',
  'SFS 1980:848',
  'SFS 1980:849',
  'SFS 1980:863',
  'SFS 1980:864',
  'SFS 1980:865',
  'SFS 1980:872',
  'SFS 1980:894',
  'SFS 1980:896',
  'SFS 1980:900',
  'SFS 1980:94',
  'SFS 1980:953',
  'SFS 1980:954',
  'SFS 1980:966',
  'SFS 1980:995',
  'SFS 1980:996',
  // 1999 laws (173)
  'SFS 1999:1',
  'SFS 1999:1040',
  'SFS 1999:1041',
  'SFS 1999:105',
  'SFS 1999:1066',
  'SFS 1999:1067',
  'SFS 1999:1075',
  'SFS 1999:1076',
  'SFS 1999:1078',
  'SFS 1999:1079',
  'SFS 1999:1134',
  'SFS 1999:1135',
  'SFS 1999:1148',
  'SFS 1999:1155',
  'SFS 1999:116',
  'SFS 1999:1166',
  'SFS 1999:1170',
  'SFS 1999:1175',
  'SFS 1999:1176',
  'SFS 1999:1177',
  'SFS 1999:1178',
  'SFS 1999:1209',
  'SFS 1999:1211',
  'SFS 1999:1218',
  'SFS 1999:1222',
  'SFS 1999:1229',
  'SFS 1999:1230',
  'SFS 1999:130',
  'SFS 1999:1305',
  'SFS 1999:1309',
  'SFS 1999:131',
  'SFS 1999:1312',
  'SFS 1999:1319',
  'SFS 1999:132',
  'SFS 1999:133',
  'SFS 1999:1352',
  'SFS 1999:1354',
  'SFS 1999:1365',
  'SFS 1999:1377',
  'SFS 1999:1382',
  'SFS 1999:1383',
  'SFS 1999:1385',
  'SFS 1999:1395',
  'SFS 1999:1415',
  'SFS 1999:1419',
  'SFS 1999:1420',
  'SFS 1999:1421',
  'SFS 1999:1423',
  'SFS 1999:1424',
  'SFS 1999:1432',
  'SFS 1999:1433',
  'SFS 1999:146',
  'SFS 1999:152',
  'SFS 1999:154',
  'SFS 1999:158',
  'SFS 1999:163',
  'SFS 1999:170',
  'SFS 1999:171',
  'SFS 1999:175',
  'SFS 1999:178',
  'SFS 1999:18',
  'SFS 1999:185',
  'SFS 1999:189',
  'SFS 1999:192',
  'SFS 1999:199',
  'SFS 1999:208',
  'SFS 1999:209',
  'SFS 1999:212',
  'SFS 1999:213',
  'SFS 1999:215',
  'SFS 1999:216',
  'SFS 1999:221',
  'SFS 1999:233',
  'SFS 1999:234',
  'SFS 1999:241',
  'SFS 1999:247',
  'SFS 1999:249',
  'SFS 1999:250',
  'SFS 1999:256',
  'SFS 1999:264',
  'SFS 1999:265',
  'SFS 1999:268',
  'SFS 1999:271',
  'SFS 1999:272',
  'SFS 1999:279',
  'SFS 1999:288',
  'SFS 1999:289',
  'SFS 1999:290',
  'SFS 1999:291',
  'SFS 1999:292',
  'SFS 1999:3',
  'SFS 1999:32',
  'SFS 1999:332',
  'SFS 1999:341',
  'SFS 1999:344',
  'SFS 1999:350',
  'SFS 1999:353',
  'SFS 1999:355',
  'SFS 1999:371',
  'SFS 1999:380',
  'SFS 1999:381',
  'SFS 1999:382',
  'SFS 1999:42',
  'SFS 1999:445',
  'SFS 1999:446',
  'SFS 1999:454',
  'SFS 1999:459',
  'SFS 1999:561',
  'SFS 1999:562',
  'SFS 1999:563',
  'SFS 1999:568',
  'SFS 1999:569',
  'SFS 1999:58',
  'SFS 1999:585',
  'SFS 1999:591',
  'SFS 1999:594',
  'SFS 1999:608',
  'SFS 1999:610',
  'SFS 1999:613',
  'SFS 1999:614',
  'SFS 1999:637',
  'SFS 1999:638',
  'SFS 1999:648',
  'SFS 1999:657',
  'SFS 1999:658',
  'SFS 1999:659',
  'SFS 1999:660',
  'SFS 1999:673',
  'SFS 1999:678',
  'SFS 1999:704',
  'SFS 1999:707',
  'SFS 1999:710',
  'SFS 1999:711',
  'SFS 1999:713',
  'SFS 1999:716',
  'SFS 1999:725',
  'SFS 1999:728',
  'SFS 1999:729',
  'SFS 1999:731',
  'SFS 1999:740',
  'SFS 1999:751',
  'SFS 1999:762',
  'SFS 1999:766',
  'SFS 1999:767',
  'SFS 1999:768',
  'SFS 1999:779',
  'SFS 1999:780',
  'SFS 1999:795',
  'SFS 1999:797',
  'SFS 1999:798',
  'SFS 1999:799',
  'SFS 1999:81',
  'SFS 1999:836',
  'SFS 1999:855',
  'SFS 1999:856',
  'SFS 1999:877',
  'SFS 1999:889',
  'SFS 1999:890',
  'SFS 1999:892',
  'SFS 1999:9',
  'SFS 1999:90',
  'SFS 1999:902',
  'SFS 1999:903',
  'SFS 1999:932',
  'SFS 1999:963',
  'SFS 1999:969',
  'SFS 1999:974',
  'SFS 1999:975',
  'SFS 1999:976',
  'SFS 1999:988',
  'SFS 1999:991',
  'SFS 1999:994',
  'SFS 1999:997',
  'SFS 1999:998',
  // 2000 laws (207)
  'SFS 2000:1006',
  'SFS 2000:1012',
  'SFS 2000:1025',
  'SFS 2000:1029',
  'SFS 2000:1036',
  'SFS 2000:1047',
  'SFS 2000:1059',
  'SFS 2000:1064',
  'SFS 2000:1074',
  'SFS 2000:1077',
  'SFS 2000:1078',
  'SFS 2000:1086',
  'SFS 2000:1087',
  'SFS 2000:1101',
  'SFS 2000:1125',
  'SFS 2000:1127',
  'SFS 2000:1132',
  'SFS 2000:1133',
  'SFS 2000:1149',
  'SFS 2000:1156',
  'SFS 2000:1169',
  'SFS 2000:1171',
  'SFS 2000:1172',
  'SFS 2000:1175',
  'SFS 2000:1178',
  'SFS 2000:1193',
  'SFS 2000:1198',
  'SFS 2000:1199',
  'SFS 2000:121',
  'SFS 2000:1210',
  'SFS 2000:1211',
  'SFS 2000:1212',
  'SFS 2000:1217',
  'SFS 2000:1219',
  'SFS 2000:1222',
  'SFS 2000:1225',
  'SFS 2000:124',
  'SFS 2000:1281',
  'SFS 2000:130',
  'SFS 2000:1306',
  'SFS 2000:131',
  'SFS 2000:1329',
  'SFS 2000:1330',
  'SFS 2000:1333',
  'SFS 2000:1335',
  'SFS 2000:1336',
  'SFS 2000:1339',
  'SFS 2000:1367',
  'SFS 2000:1377',
  'SFS 2000:138',
  'SFS 2000:1380',
  'SFS 2000:1383',
  'SFS 2000:1389',
  'SFS 2000:140',
  'SFS 2000:1418',
  'SFS 2000:142',
  'SFS 2000:1440',
  'SFS 2000:1449',
  'SFS 2000:1469',
  'SFS 2000:1472',
  'SFS 2000:1473',
  'SFS 2000:1477',
  'SFS 2000:150',
  'SFS 2000:151',
  'SFS 2000:152',
  'SFS 2000:158',
  'SFS 2000:162',
  'SFS 2000:171',
  'SFS 2000:192',
  'SFS 2000:193',
  'SFS 2000:194',
  'SFS 2000:20',
  'SFS 2000:207',
  'SFS 2000:208',
  'SFS 2000:209',
  'SFS 2000:216',
  'SFS 2000:218',
  'SFS 2000:22',
  'SFS 2000:224',
  'SFS 2000:258',
  'SFS 2000:268',
  'SFS 2000:269',
  'SFS 2000:271',
  'SFS 2000:274',
  'SFS 2000:275',
  'SFS 2000:278',
  'SFS 2000:279',
  'SFS 2000:281',
  'SFS 2000:282',
  'SFS 2000:283',
  'SFS 2000:284',
  'SFS 2000:287',
  'SFS 2000:3',
  'SFS 2000:306',
  'SFS 2000:308',
  'SFS 2000:309',
  'SFS 2000:334',
  'SFS 2000:338',
  'SFS 2000:343',
  'SFS 2000:344',
  'SFS 2000:35',
  'SFS 2000:383',
  'SFS 2000:388',
  'SFS 2000:4',
  'SFS 2000:415',
  'SFS 2000:419',
  'SFS 2000:450',
  'SFS 2000:451',
  'SFS 2000:452',
  'SFS 2000:453',
  'SFS 2000:46',
  'SFS 2000:461',
  'SFS 2000:462',
  'SFS 2000:466',
  'SFS 2000:521',
  'SFS 2000:523',
  'SFS 2000:537',
  'SFS 2000:538',
  'SFS 2000:542',
  'SFS 2000:553',
  'SFS 2000:554',
  'SFS 2000:555',
  'SFS 2000:562',
  'SFS 2000:577',
  'SFS 2000:585',
  'SFS 2000:588',
  'SFS 2000:592',
  'SFS 2000:599',
  'SFS 2000:6',
  'SFS 2000:604',
  'SFS 2000:605',
  'SFS 2000:606',
  'SFS 2000:614',
  'SFS 2000:625',
  'SFS 2000:628',
  'SFS 2000:63',
  'SFS 2000:630',
  'SFS 2000:634',
  'SFS 2000:648',
  'SFS 2000:650',
  'SFS 2000:654',
  'SFS 2000:655',
  'SFS 2000:662',
  'SFS 2000:669',
  'SFS 2000:671',
  'SFS 2000:672',
  'SFS 2000:673',
  'SFS 2000:684',
  'SFS 2000:688',
  'SFS 2000:690',
  'SFS 2000:7',
  'SFS 2000:702',
  'SFS 2000:704',
  'SFS 2000:705',
  'SFS 2000:723',
  'SFS 2000:724',
  'SFS 2000:725',
  'SFS 2000:726',
  'SFS 2000:727',
  'SFS 2000:737',
  'SFS 2000:740',
  'SFS 2000:753',
  'SFS 2000:754',
  'SFS 2000:755',
  'SFS 2000:806',
  'SFS 2000:82',
  'SFS 2000:832',
  'SFS 2000:833',
  'SFS 2000:836',
  'SFS 2000:86',
  'SFS 2000:866',
  'SFS 2000:873',
  'SFS 2000:898',
  'SFS 2000:980',
  'SFS 2000:981',
  // 2024 laws (107)
  'SFS 2024:1000',
  'SFS 2024:1002',
  'SFS 2024:1005',
  'SFS 2024:1006',
  'SFS 2024:1009',
  'SFS 2024:102',
  'SFS 2024:1020',
  'SFS 2024:1026',
  'SFS 2024:1056',
  'SFS 2024:1061',
  'SFS 2024:1062',
  'SFS 2024:107',
  'SFS 2024:1076',
  'SFS 2024:1082',
  'SFS 2024:1084',
  'SFS 2024:1085',
  'SFS 2024:1086',
  'SFS 2024:1089',
  'SFS 2024:1098',
  'SFS 2024:11',
  'SFS 2024:1102',
  'SFS 2024:1124',
  'SFS 2024:1125',
  'SFS 2024:114',
  'SFS 2024:1146',
  'SFS 2024:1150',
  'SFS 2024:1159',
  'SFS 2024:1167',
  'SFS 2024:1168',
  'SFS 2024:1170',
  'SFS 2024:1180',
  'SFS 2024:1194',
  'SFS 2024:1205',
  'SFS 2024:1212',
  'SFS 2024:1230',
  'SFS 2024:1231',
  'SFS 2024:1236',
  'SFS 2024:1243',
  'SFS 2024:1252',
  'SFS 2024:1253',
  'SFS 2024:127',
  'SFS 2024:1274',
  'SFS 2024:1278',
  'SFS 2024:1292',
  'SFS 2024:1300',
  'SFS 2024:1316',
  'SFS 2024:1329',
  'SFS 2024:1333',
  'SFS 2024:1340',
  'SFS 2024:1341',
  'SFS 2024:1344',
  'SFS 2024:1350',
  'SFS 2024:1367',
  'SFS 2024:1373',
  'SFS 2024:14',
  'SFS 2024:147',
  'SFS 2024:152',
  'SFS 2024:156',
  'SFS 2024:158',
  'SFS 2024:161',
  'SFS 2024:172',
  'SFS 2024:173',
  'SFS 2024:183',
  'SFS 2024:193',
  'SFS 2024:199',
  'SFS 2024:202',
  'SFS 2024:221',
  'SFS 2024:222',
  'SFS 2024:237',
  'SFS 2024:238',
  'SFS 2024:299',
  'SFS 2024:30',
  'SFS 2024:307',
  'SFS 2024:31',
  'SFS 2024:326',
  'SFS 2024:333',
  'SFS 2024:364',
  'SFS 2024:365',
  'SFS 2024:370',
  'SFS 2024:404',
  'SFS 2024:406',
  'SFS 2024:439',
  'SFS 2024:458',
  'SFS 2024:460',
  'SFS 2024:461',
  'SFS 2024:487',
  'SFS 2024:488',
  'SFS 2024:500',
  'SFS 2024:502',
  'SFS 2024:506',
  'SFS 2024:532',
  'SFS 2024:535',
  'SFS 2024:56',
  'SFS 2024:595',
  'SFS 2024:609',
  'SFS 2024:613',
  'SFS 2024:62',
  'SFS 2024:626',
  'SFS 2024:627',
  'SFS 2024:632',
  'SFS 2024:663',
  'SFS 2024:664',
  'SFS 2024:669',
  'SFS 2024:672',
  'SFS 2024:675',
  'SFS 2024:677',
  'SFS 2024:683',
  'SFS 2024:685',
  'SFS 2024:690',
  'SFS 2024:691',
  'SFS 2024:699',
  'SFS 2024:7',
  'SFS 2024:70',
  'SFS 2024:710',
  'SFS 2024:759',
  'SFS 2024:78',
  'SFS 2024:782',
  'SFS 2024:79',
  'SFS 2024:902',
  'SFS 2024:921',
  'SFS 2024:922',
  'SFS 2024:923',
  'SFS 2024:924',
  'SFS 2024:925',
  'SFS 2024:926',
  'SFS 2024:938',
  'SFS 2024:941',
  'SFS 2024:945',
  'SFS 2024:952',
  'SFS 2024:953',
  'SFS 2024:954',
  'SFS 2024:958',
  'SFS 2024:960',
  'SFS 2024:983',
  'SFS 2024:987',
  'SFS 2024:988',
  'SFS 2024:989',
  'SFS 2024:99',
  'SFS 2024:994',
  // 2025 laws (9) + N-series (8)
  'SFS 2025:1323',
  'SFS 2025:1350',
  'SFS 2025:1390',
  'SFS 2025:1391',
  'SFS 2025:1400',
  'SFS 2025:1408',
  'SFS 2025:1410',
  'SFS 2025:1421',
  'SFS 2025:1452',
  'SFS N2025:14',
  'SFS N2025:15',
  'SFS N2025:16',
  'SFS N2025:17',
  'SFS N2025:18',
  'SFS N2025:19',
  'SFS N2025:20',
  'SFS N2025:21',
]

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Convert SFS number to Riksdagen document ID
 * "SFS 1977:480" -> "sfs-1977-480"
 * "SFS N2025:14" -> "sfs-n2025-14"
 */
function sfsToDocId(sfsNumber: string): string {
  // Remove "SFS " prefix
  let id = sfsNumber.substring(4)
  // Replace : with -
  id = id.replace(':', '-')
  // Lowercase for consistency
  id = id.toLowerCase()
  return 'sfs-' + id
}

/**
 * Fetch document metadata from Riksdagen API
 */
async function fetchDocumentMetadata(dokId: string): Promise<{
  title: string
  publicationDate: Date | null
} | null> {
  const url = `https://data.riksdagen.se/dokument/${dokId}.json`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const doc = data.dokumentstatus?.dokument

    if (!doc) return null

    return {
      title: doc.titel || doc.notisrubrik || `Document ${dokId}`,
      publicationDate: doc.datum ? new Date(doc.datum) : null,
    }
  } catch {
    return null
  }
}

// ============================================================================
// Main Ingestion
// ============================================================================

async function ingestMissingByID() {
  const startTime = new Date()

  console.log('='.repeat(80))
  console.log('Ingesting Missing SFS Laws by Direct ID Lookup')
  console.log('='.repeat(80))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Total to process: ${MISSING_SFS.length}`)
  console.log('')

  const stats = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    noContent: 0,
  }

  // Skip historical "bih." laws - they need special handling
  const standardLaws = MISSING_SFS.filter((sfs) => !sfs.includes('bih.'))
  const historicalLaws = MISSING_SFS.filter((sfs) => sfs.includes('bih.'))

  console.log(`📋 Standard laws to fetch: ${standardLaws.length}`)
  console.log(`📋 Historical "bih." laws (skipped): ${historicalLaws.length}`)
  console.log('')

  for (let i = 0; i < standardLaws.length; i++) {
    const sfsNumber = standardLaws[i]!
    stats.processed++

    // Progress logging
    if (
      stats.processed % CONFIG.PROGRESS_LOG_INTERVAL === 0 ||
      stats.processed === 1
    ) {
      const percent = Math.round((stats.processed / standardLaws.length) * 100)
      const elapsed = Date.now() - startTime.getTime()
      const rate = stats.processed / (elapsed / 1000)
      const remaining = (standardLaws.length - stats.processed) / rate
      console.log(
        `📈 Progress: ${stats.processed}/${standardLaws.length} (${percent}%) | ` +
          `Inserted: ${stats.inserted} | Failed: ${stats.failed} | ` +
          `ETA: ${Math.round(remaining / 60)}m`
      )
    }

    // Check if already exists
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNumber },
    })

    if (existing) {
      stats.skipped++
      continue
    }

    // Construct document ID
    const dokId = sfsToDocId(sfsNumber)

    try {
      // Fetch HTML and plain text content
      const [htmlContent, fullText, metadata] = await Promise.all([
        fetchLawHTML(dokId),
        fetchLawFullText(dokId),
        fetchDocumentMetadata(dokId),
      ])

      if (!fullText && !htmlContent) {
        console.log(`  ⚠️  No content for ${sfsNumber} (${dokId})`)
        stats.noContent++
        stats.failed++
        continue
      }

      // Use metadata for title, or generate from SFS number
      const title = metadata?.title || `Lag ${sfsNumber.substring(4)}`
      const publicationDate =
        metadata?.publicationDate || extractYearFromSFS(sfsNumber)

      // Generate slug
      const slug = generateSlug(title, sfsNumber)

      // Insert into database
      await prisma.legalDocument.create({
        data: {
          document_number: sfsNumber,
          title,
          slug,
          content_type: ContentType.SFS_LAW,
          full_text: fullText,
          html_content: htmlContent,
          publication_date: publicationDate,
          status: DocumentStatus.ACTIVE,
          source_url: `https://data.riksdagen.se/dokument/${dokId}`,
          metadata: {
            dokId,
            source: 'data.riksdagen.se',
            fetchedAt: new Date().toISOString(),
            method: 'direct-id-lookup',
          },
        },
      })

      stats.inserted++
    } catch (error) {
      console.error(
        `  ❌ Error processing ${sfsNumber}:`,
        error instanceof Error ? error.message : error
      )
      stats.failed++
    }

    // Rate limiting
    await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
  }

  // Print summary
  const endTime = new Date()
  const duration = endTime.getTime() - startTime.getTime()
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  console.log('')
  console.log('='.repeat(80))
  console.log('✅ INGESTION COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Processed:     ${stats.processed}`)
  console.log(`✅ Inserted:      ${stats.inserted}`)
  console.log(`⏭️  Skipped:       ${stats.skipped}`)
  console.log(`❌ Failed:        ${stats.failed}`)
  console.log(`📭 No content:    ${stats.noContent}`)
  console.log('')
  console.log(`⏱️  Duration: ${minutes}m ${seconds}s`)
  console.log('')

  // Verify final count
  const finalCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`📊 Total SFS_LAW in database: ${finalCount}`)

  // Check remaining gap
  const apiResponse = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const apiData = await apiResponse.json()
  const apiTotal = parseInt(apiData.dokumentlista['@traffar'], 10)

  console.log(`📊 API reports total: ${apiTotal}`)
  console.log(`📊 Gap remaining: ${apiTotal - finalCount}`)
  console.log('')

  if (historicalLaws.length > 0) {
    console.log(
      '⚠️  Historical "bih." laws were skipped (need special handling):'
    )
    historicalLaws.forEach((sfs) => console.log(`   - ${sfs}`))
  }

  await prisma.$disconnect()
}

function extractYearFromSFS(sfsNumber: string): Date | null {
  const match = sfsNumber.match(/SFS (\d{4}):/)
  if (match) {
    return new Date(parseInt(match[1]), 0, 1)
  }
  return null
}

// Run
ingestMissingByID().catch(console.error)
