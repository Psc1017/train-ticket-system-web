/**
 * 新的票价折扣规则
 * 根据车次K值、日期类型、时段、提前购票天数计算折扣
 */

// K=1 折扣表（上浮55%）
const K1_DISCOUNT = {
  workday: {
    peak: { '1-3': 1.13, '4-9': 1.07, '10+': 1.01 },      // 平峰 6:00-6:59
    valley: { '1-3': 1.06, '4-9': 1.01, '10+': 0.95 }     // 低谷 7:00-20:59
  },
  weekend: {
    high: { '1-3': 1.26, '4-9': 1.19, '10+': 1.13 },      // 高峰 6:00-6:59, 14:00-14:59
    peak: { '1-3': 1.19, '4-9': 1.13, '10+': 1.07 },      // 平峰 7:00-7:59, 9:00-11:59
    valley: { '1-3': 1.13, '4-9': 1.07, '10+': 1.01 }     // 低谷 8:00-8:59, 12:00-13:59, 15:00-20:59
  },
  holiday: {
    high: { '1-3': 1.33, '4-9': 1.26, '10+': 1.19 },      // 高峰 6:00-6:59, 14:00-14:59
    peak: { '1-3': 1.26, '4-9': 1.19, '10+': 1.13 },      // 平峰 7:00-13:59, 15:00-19:59
    valley: { '1-3': 1.19, '4-9': 1.13, '10+': 1.06 }     // 低谷 20:00-20:59
  }
}

// K=2 折扣表（上浮25%）
const K2_DISCOUNT = {
  workday: {
    peak: { '1-3': 0.91, '4-9': 0.86, '10+': 0.81 },
    valley: { '1-3': 0.86, '4-9': 0.81, '10+': 0.77 }
  },
  weekend: {
    high: { '1-3': 1.02, '4-9': 0.96, '10+': 0.91 },
    peak: { '1-3': 0.96, '4-9': 0.91, '10+': 0.86 },
    valley: { '1-3': 0.91, '4-9': 0.86, '10+': 0.81 }
  },
  holiday: {
    high: { '1-3': 1.07, '4-9': 1.02, '10+': 0.96 },
    peak: { '1-3': 1.02, '4-9': 0.96, '10+': 0.91 },
    valley: { '1-3': 0.96, '4-9': 0.91, '10+': 0.86 }
  }
}

// K=3 折扣表（原价）
const K3_DISCOUNT = {
  workday: {
    peak: { '1-3': 0.73, '4-9': 0.69, '10+': 0.65 },
    valley: { '1-3': 0.69, '4-9': 0.65, '10+': 0.61 }
  },
  weekend: {
    high: { '1-3': 0.81, '4-9': 0.77, '10+': 0.73 },
    peak: { '1-3': 0.77, '4-9': 0.73, '10+': 0.69 },
    valley: { '1-3': 0.73, '4-9': 0.69, '10+': 0.65 }
  },
  holiday: {
    high: { '1-3': 0.86, '4-9': 0.81, '10+': 0.77 },
    peak: { '1-3': 0.81, '4-9': 0.77, '10+': 0.73 },
    valley: { '1-3': 0.77, '4-9': 0.73, '10+': 0.69 }
  }
}

// 所有K值折扣表
const DISCOUNT_TABLES = {
  1: K1_DISCOUNT,
  2: K2_DISCOUNT,
  3: K3_DISCOUNT
}

// 车次K值映射缓存
let trainKValueMap = null

/**
 * 加载车次K值映射
 */
export async function loadTrainKValueMap() {
  if (trainKValueMap) {
    return trainKValueMap
  }

  trainKValueMap = new Map()

  try {
    // 加载三个CSV文件
    const files = ['G车聚类结果.csv', 'D车聚类结果.csv', 'C车聚类结果.csv']
    
    for (const file of files) {
      try {
        const response = await fetch(`/date/${file}`)
        if (!response.ok) continue
        
        const text = await response.text()
        const lines = text.trim().split('\n')
        
        // 跳过标题行
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue
          
          const parts = line.split(',')
          if (parts.length >= 2) {
            const trainNumber = parts[0].trim()
            const kValue = parseInt(parts[1].trim(), 10)
            if (trainNumber && !isNaN(kValue) && kValue >= 1 && kValue <= 3) {
              trainKValueMap.set(trainNumber, kValue)
            }
          }
        }
      } catch (e) {
        console.warn(`加载 ${file} 失败:`, e)
      }
    }

    console.log(`已加载 ${trainKValueMap.size} 个车次的K值映射`)
    return trainKValueMap
  } catch (error) {
    console.error('加载车次K值映射失败:', error)
    return trainKValueMap
  }
}

/**
 * 获取车次的K值
 * @param {string} trainNumber - 车次号
 * @returns {number} K值（1、2或3），默认返回2
 */
export function getTrainKValue(trainNumber) {
  if (!trainKValueMap) {
    console.warn('K值映射未加载，使用默认值2')
    return 2
  }
  return trainKValueMap.get(trainNumber) || 2
}

/**
 * 根据发车时间获取时段类型
 * @param {string} departureTime - 发车时间 (HH:mm 格式)
 * @param {string} dateType - 日期类型 (workday/weekend/holiday)
 * @returns {string} 时段类型 (high/peak/valley)
 */
export function getTimePeriod(departureTime, dateType) {
  if (!departureTime) return 'valley'
  
  // 解析时间
  const timeParts = departureTime.split(':')
  const hour = parseInt(timeParts[0], 10)
  const minute = parseInt(timeParts[1] || '0', 10)
  const timeValue = hour * 100 + minute // 转换为数值便于比较

  if (dateType === 'workday') {
    // 工作日：平峰 6:00-6:59，低谷 7:00-20:59
    if (hour === 6) {
      return 'peak'
    } else if (hour >= 7 && hour <= 20) {
      return 'valley'
    }
    return 'valley' // 其他时间默认低谷
  } else if (dateType === 'weekend') {
    // 休息日：
    // 高峰 6:00-6:59, 14:00-14:59
    // 平峰 7:00-7:59, 9:00-11:59
    // 低谷 8:00-8:59, 12:00-13:59, 15:00-20:59
    if (hour === 6 || hour === 14) {
      return 'high'
    } else if (hour === 7 || (hour >= 9 && hour <= 11)) {
      return 'peak'
    } else if (hour === 8 || (hour >= 12 && hour <= 13) || (hour >= 15 && hour <= 20)) {
      return 'valley'
    }
    return 'valley'
  } else if (dateType === 'holiday') {
    // 节假日：
    // 高峰 6:00-6:59, 14:00-14:59
    // 平峰 7:00-13:59, 15:00-19:59
    // 低谷 20:00-20:59
    if (hour === 6 || hour === 14) {
      return 'high'
    } else if ((hour >= 7 && hour <= 13) || (hour >= 15 && hour <= 19)) {
      return 'peak'
    } else if (hour === 20) {
      return 'valley'
    }
    return 'peak' // 其他时间默认平峰
  }

  return 'valley'
}

/**
 * 获取提前购票天数区间
 * @param {string} advanceDaysRange - 提前购票天数区间 ('1-3', '4-9', '10+')
 * @returns {string} 区间标识
 */
export function getAdvanceDaysKey(advanceDaysRange) {
  if (advanceDaysRange === '1-3' || advanceDaysRange === '4-9' || advanceDaysRange === '10+') {
    return advanceDaysRange
  }
  // 兼容数字输入
  const days = parseInt(advanceDaysRange, 10)
  if (isNaN(days) || days <= 3) return '1-3'
  if (days <= 9) return '4-9'
  return '10+'
}

/**
 * 获取折扣率
 * @param {number} kValue - K值 (1, 2, 3)
 * @param {string} dateType - 日期类型 (workday/weekend/holiday)
 * @param {string} timePeriod - 时段 (high/peak/valley)
 * @param {string} advanceDaysKey - 提前天数区间 ('1-3', '4-9', '10+')
 * @returns {number} 折扣率
 */
export function getDiscountRate(kValue, dateType, timePeriod, advanceDaysKey) {
  const table = DISCOUNT_TABLES[kValue] || DISCOUNT_TABLES[2]
  const dateTable = table[dateType] || table.workday
  const periodTable = dateTable[timePeriod] || dateTable.valley || dateTable.peak
  return periodTable[advanceDaysKey] || 1.0
}

/**
 * 计算折扣后的票价
 * @param {number} originalPrice - 原始票价
 * @param {string} trainNumber - 车次号
 * @param {string} departureTime - 发车时间
 * @param {string} dateType - 日期类型 (workday/weekend/holiday)
 * @param {string} advanceDaysRange - 提前购票天数区间
 * @returns {object} 包含折扣信息的对象
 */
export function calculateDiscountedPrice(originalPrice, trainNumber, departureTime, dateType, advanceDaysRange) {
  const kValue = getTrainKValue(trainNumber)
  const timePeriod = getTimePeriod(departureTime, dateType)
  const advanceDaysKey = getAdvanceDaysKey(advanceDaysRange)
  const discountRate = getDiscountRate(kValue, dateType, timePeriod, advanceDaysKey)
  
  const discountedPrice = Math.round(originalPrice * discountRate * 100) / 100

  return {
    originalPrice,
    price: discountedPrice,
    discountRate,
    kValue,
    dateType,
    timePeriod,
    advanceDaysKey,
    discountInfo: `K${kValue} ${getDateTypeLabel(dateType)} ${getTimePeriodLabel(timePeriod)} ${discountRate < 1 ? Math.round((1 - discountRate) * 100) + '%折扣' : Math.round((discountRate - 1) * 100) + '%上浮'}`
  }
}

/**
 * 获取日期类型标签
 */
function getDateTypeLabel(dateType) {
  const labels = {
    workday: '工作日',
    weekend: '休息日',
    holiday: '节假日'
  }
  return labels[dateType] || dateType
}

/**
 * 获取时段标签
 */
function getTimePeriodLabel(timePeriod) {
  const labels = {
    high: '高峰',
    peak: '平峰',
    valley: '低谷'
  }
  return labels[timePeriod] || timePeriod
}

/**
 * 批量应用折扣到票价数据
 * @param {Array} tickets - 票价数组
 * @param {string} dateType - 日期类型 (workday/weekend/holiday)
 * @param {string} advanceDaysRange - 提前购票天数区间 ('1-3', '4-9', '10+')
 * @returns {Array} 应用折扣后的票价数组
 */
export function applyNewDiscountToTickets(tickets, dateType, advanceDaysRange) {
  return tickets.map(ticket => {
    const result = calculateDiscountedPrice(
      ticket.price,
      ticket.trainNumber,
      ticket.departureTime,
      dateType,
      advanceDaysRange
    )
    
    return {
      ...ticket,
      originalPrice: result.originalPrice,
      price: result.price,
      discountRate: result.discountRate,
      discountInfo: result.discountInfo,
      kValue: result.kValue,
      dateType: result.dateType,
      timePeriod: result.timePeriod
    }
  })
}

/**
 * 获取折扣说明文本
 */
export function getDiscountDescription(advanceDaysRange) {
  const labels = {
    '1-3': '提前1-3天',
    '4-9': '提前4-9天',
    '10+': '提前10天及以上'
  }
  return labels[advanceDaysRange] || advanceDaysRange
}

export { DISCOUNT_TABLES }

