/**
 * 中转搜索工具函数
 * 用于搜索需要换乘的路线
 */

import dbManager from './indexedDB'

// 中转配置
const TRANSFER_CONFIG = {
  minWaitTime: 30,        // 最短换乘时间（分钟）
  maxWaitTime: 120,       // 最长换乘时间（分钟）- 约2小时
  maxResults: 50,         // 最多返回结果数
}

/**
 * 将时间字符串转换为分钟数（从0:00开始计算）
 * @param {string} timeStr - 时间字符串，格式 "HH:mm"
 * @returns {number} 分钟数
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  const hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  return hours * 60 + minutes
}

/**
 * 将分钟数转换为时间字符串
 * @param {number} minutes - 分钟数
 * @returns {string} 时间字符串，格式 "HH:mm"
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * 计算两个时间之间的等待时间（分钟）
 * @param {string} arrivalTime - 到达时间
 * @param {string} departureTime - 出发时间
 * @returns {number} 等待时间（分钟），如果跨天则返回-1
 */
function calculateWaitTime(arrivalTime, departureTime) {
  const arrivalMinutes = timeToMinutes(arrivalTime)
  const departureMinutes = timeToMinutes(departureTime)
  
  // 如果出发时间早于到达时间，说明跨天了，不支持
  if (departureMinutes < arrivalMinutes) {
    return -1
  }
  
  return departureMinutes - arrivalMinutes
}

/**
 * 计算总行程时间（分钟）
 * @param {object} firstLeg - 第一程车票
 * @param {object} secondLeg - 第二程车票
 * @returns {number} 总时间（分钟）
 */
function calculateTotalTime(firstLeg, secondLeg) {
  const startMinutes = timeToMinutes(firstLeg.departureTime)
  const endMinutes = timeToMinutes(secondLeg.arrivalTime)
  
  // 如果结束时间早于开始时间，说明跨天了
  if (endMinutes < startMinutes) {
    return -1
  }
  
  return endMinutes - startMinutes
}

/**
 * 格式化时长显示
 * @param {number} minutes - 分钟数
 * @returns {string} 格式化的时长字符串
 */
function formatDuration(minutes) {
  if (minutes < 0) return '跨天'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
  }
  return `${mins}分钟`
}

/**
 * 搜索中转路线
 * @param {string} fromStation - 出发站
 * @param {string} toStation - 到达站
 * @param {object} options - 搜索选项
 * @returns {Promise<Array>} 中转方案数组
 */
export async function searchTransfer(fromStation, toStation, options = {}) {
  const {
    minWaitTime = TRANSFER_CONFIG.minWaitTime,
    maxWaitTime = TRANSFER_CONFIG.maxWaitTime,
    maxResults = TRANSFER_CONFIG.maxResults,
  } = options

  console.log(`开始搜索中转路线: ${fromStation} → ? → ${toStation}`)

  // 1. 获取从出发站出发的所有车次
  const firstLegTickets = await dbManager.searchByDeparture(fromStation)
  console.log(`从 ${fromStation} 出发的车次: ${firstLegTickets.length} 条`)

  if (firstLegTickets.length === 0) {
    return []
  }

  // 2. 收集所有可能的中转站（第一程的到达站，排除目的地本身）
  const possibleViaStations = [...new Set(
    firstLegTickets
      .map(t => t.toStation)
      .filter(station => station && station !== toStation && station !== fromStation)
  )]
  console.log(`可能的中转站: ${possibleViaStations.length} 个`)

  if (possibleViaStations.length === 0) {
    return []
  }

  // 3. 并行查询每个中转站到目的地的车次
  const secondLegPromises = possibleViaStations.map(viaStation => 
    dbManager.searchTicketsFuzzy(viaStation, toStation, { limit: 1000 })
      .then(tickets => ({ viaStation, tickets }))
      .catch(() => ({ viaStation, tickets: [] }))
  )

  const secondLegResults = await Promise.all(secondLegPromises)
  
  // 构建中转站到第二程车次的映射
  const secondLegMap = new Map()
  secondLegResults.forEach(({ viaStation, tickets }) => {
    if (tickets.length > 0) {
      secondLegMap.set(viaStation, tickets)
    }
  })

  console.log(`有第二程车次的中转站: ${secondLegMap.size} 个`)

  // 4. 组合并筛选合理的换乘方案
  const transferResults = []

  for (const firstLeg of firstLegTickets) {
    const viaStation = firstLeg.toStation
    
    // 检查这个中转站是否有到目的地的车次
    const secondLegTickets = secondLegMap.get(viaStation)
    if (!secondLegTickets || secondLegTickets.length === 0) {
      continue
    }

    for (const secondLeg of secondLegTickets) {
      // 计算换乘等待时间
      const waitTime = calculateWaitTime(firstLeg.arrivalTime, secondLeg.departureTime)
      
      // 检查换乘时间是否合理（不跨天，且在允许范围内）
      if (waitTime < 0 || waitTime < minWaitTime || waitTime > maxWaitTime) {
        continue
      }

      // 计算总行程时间
      const totalTime = calculateTotalTime(firstLeg, secondLeg)
      if (totalTime < 0) {
        continue // 跨天，跳过
      }

      transferResults.push({
        viaStation,
        firstLeg: { ...firstLeg },
        secondLeg: { ...secondLeg },
        waitTime,
        totalTime,
        waitTimeFormatted: formatDuration(waitTime),
        totalTimeFormatted: formatDuration(totalTime),
      })

      // 如果结果太多，提前退出
      if (transferResults.length >= maxResults * 10) {
        break
      }
    }

    if (transferResults.length >= maxResults * 10) {
      break
    }
  }

  console.log(`找到 ${transferResults.length} 个中转方案`)

  // 5. 按第一程出发时间排序，取前N个结果
  transferResults.sort((a, b) => {
    const timeA = timeToMinutes(a.firstLeg.departureTime)
    const timeB = timeToMinutes(b.firstLeg.departureTime)
    return timeA - timeB
  })

  return transferResults.slice(0, maxResults)
}

/**
 * 智能搜索：先搜直达，无直达则搜中转
 * @param {string} fromStation - 出发站
 * @param {string} toStation - 到达站
 * @param {object} options - 搜索选项
 * @returns {Promise<object>} 搜索结果 { type: 'direct'|'transfer', results: Array }
 */
export async function smartSearch(fromStation, toStation, options = {}) {
  // 1. 先搜索直达
  const directResults = await dbManager.searchTicketsFuzzy(fromStation, toStation, { limit: 5000 })
  
  if (directResults.length > 0) {
    console.log(`找到 ${directResults.length} 条直达车次`)
    return {
      type: 'direct',
      results: directResults,
      transferResults: []
    }
  }

  // 2. 无直达，搜索中转
  console.log('无直达车次，开始搜索中转路线...')
  const transferResults = await searchTransfer(fromStation, toStation, options)
  
  return {
    type: 'transfer',
    results: [],
    transferResults
  }
}

export { TRANSFER_CONFIG, formatDuration, calculateWaitTime, timeToMinutes }









