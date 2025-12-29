// 车次 -> K 映射加载与查询
// 数据来源：date/C车聚类结果.csv, date/D车聚类结果.csv, date/G车聚类结果.csv
// CSV格式：车次号,K值 或 车次号,聚类结果
// K值映射：1 -> K1, 2 -> K2, 3 -> K3

import { TRAVEL_TIME_TYPES } from './complexDiscountRule'

let trainKMap = null
let loadPromise = null

function parseCSVToMap(text) {
  const map = new Map()
  const lines = text.split(/\r?\n/)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // 跳过表头
    if (i === 0 && (line.includes('车次号') || line.includes('K值') || line.includes('聚类结果'))) {
      continue
    }
    
    // CSV格式：车次号,K值 或 车次号,聚类结果
    const parts = line.split(',')
    if (parts.length < 2) continue
    
    const train = parts[0].trim()
    const kValue = parts[1].trim()
    
    if (!train || !kValue) continue
    
    // 将K值（1, 2, 3）映射到 TRAVEL_TIME_TYPES
    let kType
    if (kValue === '1') {
      kType = TRAVEL_TIME_TYPES.K1
    } else if (kValue === '2') {
      kType = TRAVEL_TIME_TYPES.K2
    } else if (kValue === '3') {
      kType = TRAVEL_TIME_TYPES.K3
    } else {
      continue // 跳过无效的K值
    }
    
    map.set(train.toUpperCase(), kType)
  }
  
  return map
}

async function loadCSVFile(filePath) {
  try {
    const response = await fetch(filePath)
    if (!response.ok) {
      console.warn(`无法加载 ${filePath}`)
      return null
    }
    const text = await response.text()
    return parseCSVToMap(text)
  } catch (error) {
    console.warn(`加载 ${filePath} 失败:`, error)
    return null
  }
}

export async function loadTrainKMap() {
  if (trainKMap) return trainKMap
  if (!loadPromise) {
    loadPromise = Promise.all([
      loadCSVFile('/date/C车聚类结果.csv'),
      loadCSVFile('/date/D车聚类结果.csv'),
      loadCSVFile('/date/G车聚类结果.csv')
    ]).then(([cMap, dMap, gMap]) => {
      // 合并三个映射表
      trainKMap = new Map()
      
      if (cMap) {
        cMap.forEach((value, key) => trainKMap.set(key, value))
      }
      if (dMap) {
        dMap.forEach((value, key) => trainKMap.set(key, value))
      }
      if (gMap) {
        gMap.forEach((value, key) => trainKMap.set(key, value))
      }
      
      console.log(`已加载 ${trainKMap.size} 个车次的K值映射`)
      return trainKMap
    }).catch((error) => {
      console.error('加载车次K值映射失败:', error)
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
  if (!trainKMap) return TRAVEL_TIME_TYPES.K3  // 默认K3（原价）
  if (!trainNumber) return TRAVEL_TIME_TYPES.K3
  const key = String(trainNumber).toUpperCase()
  return trainKMap.get(key) || TRAVEL_TIME_TYPES.K3  // 默认K3（原价）
}



