// 车次 -> K 映射加载与查询
// 数据来源：public/11111.txt（两列：TrainNumber、ClusterClass）
// 注意：ClusterClass 数值 1 -> K0，2 -> K1

import { TRAVEL_TIME_TYPES } from './complexDiscountRule'

let trainKMap = null
let loadPromise = null

function parseTxtToMap(text) {
  const map = new Map()
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // 跳过表头（包含 TrainNumber 或 ClusterClass）
    if (i === 0 && /trainnumber/i.test(line)) continue

    // 以空白分隔：如 "G1    1"
    const parts = line.split(/\s+/)
    if (parts.length < 2) continue
    const train = parts[0].trim()
    const cls = parts[1].trim()
    if (!train) continue
    const k = cls === '2' ? TRAVEL_TIME_TYPES.K1 : TRAVEL_TIME_TYPES.K0
    map.set(train.toUpperCase(), k)
  }
  return map
}

export async function loadTrainKMap() {
  if (trainKMap) return trainKMap
  if (!loadPromise) {
    loadPromise = fetch('/11111.txt')
      .then(r => {
        if (!r.ok) throw new Error('无法加载 11111.txt')
        return r.text()
      })
      .then(text => {
        trainKMap = parseTxtToMap(text)
        return trainKMap
      })
      .catch(() => {
        trainKMap = new Map()
        return trainKMap
      })
  }
  return loadPromise
}

export async function ensureKMap() {
  await loadTrainKMap()
}

export function getKForTrain(trainNumber) {
  if (!trainKMap) return TRAVEL_TIME_TYPES.K0
  if (!trainNumber) return TRAVEL_TIME_TYPES.K0
  const key = String(trainNumber).toUpperCase()
  return trainKMap.get(key) || TRAVEL_TIME_TYPES.K0
}



