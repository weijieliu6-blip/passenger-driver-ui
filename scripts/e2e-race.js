const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const TOKEN = fs.readFileSync(path.join(__dirname, 'e2e-token2.txt'), 'utf8').trim()
const baseUrl = 'http://localhost:3000/api/driver/grab/' + TOKEN

function grab(driverFile) {
  const data = fs.readFileSync(path.join(__dirname, driverFile), 'utf8')
  // Use -w to capture HTTP code + body separately
  const cmd = `curl.exe -s -X POST "${baseUrl}" -H "Content-Type: application/json" --max-time 30 --data-binary "@${path.join(__dirname, driverFile)}" -o ${path.join(__dirname, 'race-' + driverFile.replace('e2e-driver', '').replace('.json', '') + '-resp.json')} -w "HTTP=%{http_code}\n"`
  return cmd
}

console.log('Launching both in parallel...')
const a = execSync(grab('e2e-driverA.json'), { encoding: 'utf8' })
const b = execSync(grab('e2e-driverB.json'), { encoding: 'utf8' })
console.log('A:', a)
console.log('B:', b)