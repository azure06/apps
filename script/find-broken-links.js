#!/usr/bin/env node

/* Links can break at any time and it's outside of the repo's control,
   so it doesn't make sense to put this into CI. Instead, this should
   be periodically as part of a separate periodic process. */

/* TODO: should this do anything corrective as well?
   e.g. if all the links in a file are dead, disable the file? */

const fetch = require('node-fetch')
const fsPromises = require('fs').promises
const path = require('path')
const process = require('process')
const readdirp = require('readdirp')
const yaml = require('yamljs')

// walk an object subtree looking for https:// strings
const getObjectUrls = root => {
  const urls = []
  const queue = [ root ]
  while (queue.length !== 0) {
    const vals = Object.values(queue.shift())
    urls.push(...vals.filter(v => typeof v === 'string' && v.startsWith('https://')))
    queue.push(...vals.filter(v => typeof v === 'object'))
  }
  return urls
}

// scrape a url to see if the link is broken.
// returns a promise that resolves with { url, err }
const scrape = url =>
  fetch(url, { method: 'HEAD' })
    .then(res => { return { url, err: res.ok ? null : `${res.status} ${res.statusText}` } })
    .catch(err => { return { url, err } })

// scrape all the urls found in a yml file.
// reports broken links to console.log().
// returns a promise that resolves with an array of broken links: { url, err }
const processYmlEntry = entry =>
  fsPromises.readFile(entry.fullPath, { encoding: 'utf8' })
    .then(yaml.parse)
    .then(getObjectUrls)
    .then(urls => Promise.all(urls.map(scrape)))
    .then(results => results.filter((res) => res.err))
    .then(fails => { fails.forEach(f => console.log(`${entry.path} - ${f.url} (${f.err})`)); return fails })

const topDir = path.join(path.dirname(__dirname))
readdirp.promise(topDir, { fileFilter: '*.yml', directoryFilter: entry => entry.path.startsWith('apps') })
  .then(entries => Promise.all(entries.map(processYmlEntry)))
  .then(fails => process.exit(fails.flat().length))
