/* eslint-disable no-console */
/**
 * Sync Historical Documents Without SFS Numbers
 *
 * These are 133 old Riksbank and Riksgäldskontoret regulations from 1867-1958
 * that exist in the API but have no SFS number (empty beteckning).
 *
 * We store them with document_number format: "HIST:{dok_id}"
 *
 * Usage:
 *   pnpm tsx scripts/sync-historical-no-sfs.ts
 *   pnpm tsx scripts/sync-historical-no-sfs.ts --dry-run
 */

import { prisma } from '../lib/prisma'
import { fetchLawFullText, fetchLawHTML } from '../lib/external/riksdagen'
import { ContentType, DocumentStatus } from '@prisma/client'

const DRY_RUN = process.argv.includes('--dry-run')

interface HistDoc {
  dok_id: string
  date: string
  year: number
  title: string
}

// These are the 133 documents with empty beteckning
const HISTORICAL_DOCS: HistDoc[] = [
  {
    dok_id: 'c0s0riksb',
    date: '1867-05-08',
    year: 1867,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c0s0riksg',
    date: '1867-05-15',
    year: 1867,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c1s0riksg',
    date: '1868-01-01',
    year: 1868,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c1s0riksb',
    date: '1868-05-11',
    year: 1868,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c1s0bf',
    date: '1868-09-08',
    year: 1868,
    title: 'Bevillningsförordning',
  },
  {
    dok_id: 'c2s0riksb',
    date: '1869-05-14',
    year: 1869,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c2s0riksg',
    date: '1869-05-15',
    year: 1869,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c3s0riksb',
    date: '1870-05-10',
    year: 1870,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c3s0riksg',
    date: '1870-05-14',
    year: 1870,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c4s0riksg',
    date: '1871-05-19',
    year: 1871,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c5s0riksb',
    date: '1872-05-13',
    year: 1872,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c5s0riksg',
    date: '1872-05-16',
    year: 1872,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c6s0riksb',
    date: '1873-05-23',
    year: 1873,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c6s0riksg',
    date: '1873-05-26',
    year: 1873,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c7s0riksb',
    date: '1874-05-20',
    year: 1874,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c7s0riksg',
    date: '1874-05-22',
    year: 1874,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c8s0riksb',
    date: '1875-05-19',
    year: 1875,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c8s0riksg',
    date: '1875-05-27',
    year: 1875,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'c9s0riksb',
    date: '1876-05-02',
    year: 1876,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'c9s0riksg',
    date: '1876-05-17',
    year: 1876,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cas0riksb',
    date: '1877-05-15',
    year: 1877,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cas0riksg',
    date: '1877-05-25',
    year: 1877,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cbs0riksb',
    date: '1878-05-14',
    year: 1878,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cbs0riksg',
    date: '1878-05-25',
    year: 1878,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'ccs0riksb',
    date: '1879-05-19',
    year: 1879,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'ccs0riksg',
    date: '1879-05-21',
    year: 1879,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cds0riksb',
    date: '1880-05-12',
    year: 1880,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cds0riksg',
    date: '1880-05-15',
    year: 1880,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'ces0riksb',
    date: '1881-04-19',
    year: 1881,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'ces0riksg',
    date: '1881-04-28',
    year: 1881,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cfs0riksb',
    date: '1882-05-19',
    year: 1882,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cfs0riksg',
    date: '1882-05-22',
    year: 1882,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cgs0riksb',
    date: '1883-06-09',
    year: 1883,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cgs0riksg',
    date: '1883-06-14',
    year: 1883,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'chs0riksg',
    date: '1884-01-01',
    year: 1884,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'chs0riksb',
    date: '1884-05-13',
    year: 1884,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cis0riksb',
    date: '1885-05-21',
    year: 1885,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cis0riksg',
    date: '1885-05-22',
    year: 1885,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cjs0riksb',
    date: '1886-05-16',
    year: 1886,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cjs0riksg',
    date: '1886-05-18',
    year: 1886,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cks6riksb',
    date: '1887-07-04',
    year: 1887,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cks6riksg',
    date: '1887-07-09',
    year: 1887,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cls0riksb',
    date: '1888-05-14',
    year: 1888,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cls0riksg',
    date: '1888-05-16',
    year: 1888,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cms0riksb',
    date: '1889-01-01',
    year: 1889,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cms0riksg',
    date: '1889-05-18',
    year: 1889,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cns0riksb',
    date: '1890-05-17',
    year: 1890,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cns0riksg',
    date: '1890-05-22',
    year: 1890,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cos0riksb',
    date: '1891-05-13',
    year: 1891,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cos0riksg',
    date: '1891-05-15',
    year: 1891,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cps0riksb',
    date: '1892-05-10',
    year: 1892,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cps0riksg',
    date: '1892-05-23',
    year: 1892,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cqs0riksb',
    date: '1893-05-08',
    year: 1893,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cqs0riksg',
    date: '1893-05-10',
    year: 1893,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'crs0riksb',
    date: '1894-05-10',
    year: 1894,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'crs0riksg',
    date: '1894-05-12',
    year: 1894,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'css0riksb',
    date: '1895-01-01',
    year: 1895,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'css0riksg',
    date: '1895-05-18',
    year: 1895,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cts0riksb',
    date: '1896-01-01',
    year: 1896,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cts0riksg',
    date: '1896-05-16',
    year: 1896,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cus0riksb',
    date: '1897-05-18',
    year: 1897,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cus0riksg',
    date: '1897-05-20',
    year: 1897,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cvs0riksb',
    date: '1898-05-12',
    year: 1898,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cvs0riksg',
    date: '1898-05-16',
    year: 1898,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cws0riksb',
    date: '1899-05-08',
    year: 1899,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cws0riksg',
    date: '1899-05-14',
    year: 1899,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cxs0riksb',
    date: '1900-05-09',
    year: 1900,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cxs0riksg',
    date: '1900-05-14',
    year: 1900,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'cys0riksb',
    date: '1901-01-01',
    year: 1901,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'cys0riksg',
    date: '1901-06-04',
    year: 1901,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'czs0riksb',
    date: '1902-05-20',
    year: 1902,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'czs0riksg',
    date: '1902-05-21',
    year: 1902,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd0s0riksg',
    date: '1903-01-01',
    year: 1903,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd0s0riksb',
    date: '1903-05-14',
    year: 1903,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd1s0riksb',
    date: '1904-04-29',
    year: 1904,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd1s0riksg',
    date: '1904-05-20',
    year: 1904,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd2s0riksb',
    date: '1905-05-02',
    year: 1905,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd2s0riksg',
    date: '1905-05-20',
    year: 1905,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd3s0riksb',
    date: '1906-05-11',
    year: 1906,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd3s0riksg',
    date: '1906-05-28',
    year: 1906,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd4s0riksb',
    date: '1907-05-29',
    year: 1907,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd4s0riksg',
    date: '1907-06-01',
    year: 1907,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd5s0riksg',
    date: '1908-06-03',
    year: 1908,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd6s0riksb',
    date: '1909-05-07',
    year: 1909,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd6s0riksg',
    date: '1909-05-25',
    year: 1909,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd7s0riksb',
    date: '1910-04-29',
    year: 1910,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd7s0riksg',
    date: '1910-06-10',
    year: 1910,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd8s0riksb',
    date: '1911-01-01',
    year: 1911,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'd8s0riksg',
    date: '1911-05-31',
    year: 1911,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd9s0riksg',
    date: '1912-01-01',
    year: 1912,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'd9s0riksb',
    date: '1912-05-21',
    year: 1912,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'das0riksg',
    date: '1913-01-01',
    year: 1913,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'das0riksb',
    date: '1913-05-15',
    year: 1913,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dbs8riksg',
    date: '1914-01-01',
    year: 1914,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dbs8riksb',
    date: '1914-09-10',
    year: 1914,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dcs0riksg',
    date: '1915-01-01',
    year: 1915,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dcs0riksb',
    date: '1915-05-22',
    year: 1915,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dds0riksg',
    date: '1916-01-01',
    year: 1916,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dds0riksb',
    date: '1916-06-08',
    year: 1916,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'des0riksg',
    date: '1917-01-01',
    year: 1917,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'des0riksb',
    date: '1917-06-01',
    year: 1917,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dfs0riksg',
    date: '1918-01-01',
    year: 1918,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dfs0riksb',
    date: '1918-06-15',
    year: 1918,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dgs0riksb',
    date: '1919-06-06',
    year: 1919,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dgs0riksg',
    date: '1919-07-01',
    year: 1919,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dhs0riksg',
    date: '1920-01-01',
    year: 1920,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dhs0riksb',
    date: '1920-06-19',
    year: 1920,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dis0riksg',
    date: '1921-01-01',
    year: 1921,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dis0riksb',
    date: '1921-06-20',
    year: 1921,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'djs0riksg',
    date: '1922-01-01',
    year: 1922,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dks0riksg',
    date: '1923-01-01',
    year: 1923,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dls0riksb',
    date: '1924-06-06',
    year: 1924,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dls0riksg',
    date: '1924-10-01',
    year: 1924,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dms0riksg',
    date: '1925-01-01',
    year: 1925,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dns0riksg',
    date: '1926-01-01',
    year: 1926,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dos0riksg',
    date: '1927-01-01',
    year: 1927,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dps0riksg',
    date: '1928-01-01',
    year: 1928,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dqs0riksg',
    date: '1929-01-01',
    year: 1929,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'drs0riksg',
    date: '1930-06-04',
    year: 1930,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dss0riksb',
    date: '1931-05-27',
    year: 1931,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dvs0riksb',
    date: '1934-06-15',
    year: 1934,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dws0riksg',
    date: '1935-06-14',
    year: 1935,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dws0riksb',
    date: '1935-06-14',
    year: 1935,
    title: 'Reglemente för Riksbankens styrelse och förvaltning',
  },
  {
    dok_id: 'dzs0riksg',
    date: '1938-06-15',
    year: 1938,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'dzs0riksb',
    date: '1938-06-15',
    year: 1938,
    title:
      'Reglemente för Riksbankens styrelse och förvaltning (Bankoreglementet)',
  },
  {
    dok_id: 'e0s0riksg',
    date: '1939-06-13',
    year: 1939,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'e0s0riksb',
    date: '1939-06-13',
    year: 1939,
    title:
      'Reglemente för Riksbankens styrelse och förvaltning (Bankoreglementet)',
  },
  {
    dok_id: 'e2s0riksg',
    date: '1941-06-26',
    year: 1941,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'e4s0riksb',
    date: '1943-12-15',
    year: 1943,
    title:
      'Reglemente för Riksbankens styrelse och förvaltning (Bankoreglementet)',
  },
  {
    dok_id: 'e9s0riksg',
    date: '1948-07-03',
    year: 1948,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'eds0riksg',
    date: '1952-05-31',
    year: 1952,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'efs0riksg',
    date: '1954-05-31',
    year: 1954,
    title: 'Reglemente för Riksgäldskontoret',
  },
  {
    dok_id: 'ejs8riksg',
    date: '1958-07-31',
    year: 1958,
    title: 'Reglemente för Riksgäldskontoret',
  },
]

function generateSlug(title: string, dokId: string): string {
  // Simple slug from title
  return (
    title
      .toLowerCase()
      .replace(/[åä]/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) +
    '-' +
    dokId
  )
}

async function fetchDocumentContent(
  dokId: string
): Promise<{ text: string; html: string } | null> {
  try {
    const [text, html] = await Promise.all([
      fetchLawFullText(dokId),
      fetchLawHTML(dokId),
    ])
    return { text: text || '', html: html || '' }
  } catch (error) {
    console.error(`  Failed to fetch content for ${dokId}:`, error)
    return null
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Sync Historical Documents Without SFS Numbers')
  console.log('='.repeat(60))
  console.log(`Total documents: ${HISTORICAL_DOCS.length}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const doc of HISTORICAL_DOCS) {
    const documentNumber = `HIST:${doc.dok_id}`

    // Check if already exists
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: documentNumber },
    })

    if (existing) {
      console.log(`⏭️  ${documentNumber} already exists, skipping`)
      skipped++
      continue
    }

    console.log(`📥 Fetching ${documentNumber} (${doc.year})...`)

    // Fetch content
    const content = await fetchDocumentContent(doc.dok_id)
    if (!content) {
      console.log(`  ❌ Failed to fetch content`)
      failed++
      continue
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would insert: ${doc.title}`)
      inserted++
      continue
    }

    // Insert document
    try {
      await prisma.legalDocument.create({
        data: {
          document_number: documentNumber,
          title: doc.title,
          slug: generateSlug(doc.title, doc.dok_id),
          content_type: ContentType.SFS_LAW,
          status: DocumentStatus.REPEALED, // These are all historical/repealed
          effective_date: new Date(doc.date),
          full_text: content.text,
          html_content: content.html,
          source_url: `https://data.riksdagen.se/dokument/${doc.dok_id}`,
          metadata: {
            dokId: doc.dok_id,
            source: 'riksdagen',
            isHistorical: true,
            noSfsNumber: true,
            fetchedAt: new Date().toISOString(),
          },
        },
      })
      console.log(`  ✅ Inserted`)
      inserted++
    } catch (error) {
      console.error(`  ❌ Failed to insert:`, error)
      failed++
    }

    // Small delay to be nice to the API
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
