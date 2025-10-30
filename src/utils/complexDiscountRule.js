/**
 * 复杂多因素折扣规则系统
 * 支持：出发日期、发车时段、提前购票、旅行时间、票价浮动情景
 */

// 票价浮动情景
export const PRICE_FLOAT_SCENARIOS = {
  FLOAT_10: '10%浮动',
  FLOAT_20: '20%浮动', 
  FLOAT_30: '30%浮动'
}

// 出发日期类型
export const DATE_TYPES = {
  WORKDAY: '工作日',
  WEEKEND: '休息日',
  HOLIDAY: '节假日'
}

// 发车时段
export const TIME_PERIODS = {
  PEAK: '高峰时段',
  NORMAL: '平峰时段', 
  LOW: '低谷时段'
}

// 旅行时间类型
export const TRAVEL_TIME_TYPES = {
  K0: 'K=0',
  K1: 'K=1'
}

// 10%浮动折扣表
const DISCOUNT_TABLE_10 = {
  [DATE_TYPES.WORKDAY]: {
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (6:00-6:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.80, 4: 0.76, 10: 0.72 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.72, 4: 0.68, 10: 0.64 }
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (7:00-20:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.76, 4: 0.72, 10: 0.68 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.68, 4: 0.64, 10: 0.61 }
    }
  },
  [DATE_TYPES.WEEKEND]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.89, 4: 0.85, 10: 0.80 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.80, 4: 0.76, 10: 0.72 }
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-7:59、9:00-11:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.85, 4: 0.80, 10: 0.76 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.76, 4: 0.72, 10: 0.68 }
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (8:00-8:59、12:00-13:59、15:00-20:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.80, 4: 0.76, 10: 0.72 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.72, 4: 0.68, 10: 0.64 }
    }
  },
  [DATE_TYPES.HOLIDAY]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.94, 4: 0.89, 10: 0.84 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.85, 4: 0.80, 10: 0.76 }
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-13:59、15:00-19:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.89, 4: 0.85, 10: 0.80 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.80, 4: 0.76, 10: 0.72 }
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (20:00-20:59)
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.84, 4: 0.80, 10: 0.76 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.76, 4: 0.72, 10: 0.68 }
    }
  }
}

// 20%浮动折扣表
const DISCOUNT_TABLE_20 = {
  [DATE_TYPES.WORKDAY]: {
    [TIME_PERIODS.NORMAL]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.87, 4: 0.83, 10: 0.78 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.78, 4: 0.74, 10: 0.70 }
    },
    [TIME_PERIODS.LOW]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.82, 4: 0.78, 10: 0.74 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.74, 4: 0.70, 10: 0.66 }
    }
  },
  [DATE_TYPES.WEEKEND]: {
    [TIME_PERIODS.PEAK]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.97, 4: 0.92, 10: 0.87 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.88, 4: 0.83, 10: 0.78 }
    },
    [TIME_PERIODS.NORMAL]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.92, 4: 0.87, 10: 0.83 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.83, 4: 0.79, 10: 0.74 }
    },
    [TIME_PERIODS.LOW]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.87, 4: 0.83, 10: 0.78 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.78, 4: 0.74, 10: 0.70 }
    }
  },
  [DATE_TYPES.HOLIDAY]: {
    [TIME_PERIODS.PEAK]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 1.03, 4: 0.97, 10: 0.92 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.93, 4: 0.88, 10: 0.83 }
    },
    [TIME_PERIODS.NORMAL]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.97, 4: 0.92, 10: 0.87 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.88, 4: 0.83, 10: 0.78 }
    },
    [TIME_PERIODS.LOW]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.92, 4: 0.87, 10: 0.82 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.83, 4: 0.78, 10: 0.74 }
    }
  }
}

// 30%浮动折扣表
const DISCOUNT_TABLE_30 = {
  [DATE_TYPES.WORKDAY]: {
    [TIME_PERIODS.NORMAL]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.94, 4: 0.90, 10: 0.85 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.85, 4: 0.81, 10: 0.76 }
    },
    [TIME_PERIODS.LOW]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.89, 4: 0.85, 10: 0.80 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.80, 4: 0.76, 10: 0.72 }
    }
  },
  [DATE_TYPES.WEEKEND]: {
    [TIME_PERIODS.PEAK]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 1.06, 4: 1.00, 10: 0.94 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.95, 4: 0.90, 10: 0.85 }
    },
    [TIME_PERIODS.NORMAL]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 1.00, 4: 0.95, 10: 0.90 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.90, 4: 0.85, 10: 0.81 }
    },
    [TIME_PERIODS.LOW]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 0.94, 4: 0.90, 10: 0.85 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.85, 4: 0.81, 10: 0.76 }
    }
  },
  [DATE_TYPES.HOLIDAY]: {
    [TIME_PERIODS.PEAK]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 1.11, 4: 1.06, 10: 1.00 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 1.00, 4: 0.95, 10: 0.90 }
    },
    [TIME_PERIODS.NORMAL]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 1.06, 4: 1.00, 10: 0.95 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.95, 4: 0.90, 10: 0.85 }
    },
    [TIME_PERIODS.LOW]: {
      [TRAVEL_TIME_TYPES.K0]: { 1: 1.00, 4: 0.94, 10: 0.89 },
      [TRAVEL_TIME_TYPES.K1]: { 1: 0.90, 4: 0.85, 10: 0.80 }
    }
  }
}

// 折扣表映射
const DISCOUNT_TABLES = {
  [PRICE_FLOAT_SCENARIOS.FLOAT_10]: DISCOUNT_TABLE_10,
  [PRICE_FLOAT_SCENARIOS.FLOAT_20]: DISCOUNT_TABLE_20,
  [PRICE_FLOAT_SCENARIOS.FLOAT_30]: DISCOUNT_TABLE_30
}

/**
 * 判断日期类型
 * @param {Date} date 日期
 * @returns {string} 日期类型
 */
export function getDateType(date) {
  const day = date.getDay()
  
  // 简单判断：0=周日, 6=周六为休息日
  if (day === 0 || day === 6) {
    return DATE_TYPES.WEEKEND
  }
  
  // 这里可以添加更复杂的节假日判断逻辑
  // 比如检查是否在法定节假日列表中
  // 暂时返回工作日
  return DATE_TYPES.WORKDAY
}

/**
 * 自动判断日期类型（从票价数据中提取）
 * @param {string} departureDate 出发日期字符串
 * @returns {string} 日期类型
 */
export function getDateTypeFromString(departureDate) {
  if (!departureDate) return DATE_TYPES.WORKDAY
  
  const date = new Date(departureDate)
  return getDateType(date)
}

/**
 * 判断发车时段
 * @param {string} departureTime 发车时间 (HH:mm)
 * @param {string} dateType 日期类型
 * @returns {string} 时段类型
 */
export function getTimePeriod(departureTime, dateType) {
  const [hour, minute] = departureTime.split(':').map(Number)
  const timeInMinutes = hour * 60 + minute
  
  if (dateType === DATE_TYPES.WORKDAY) {
    // 工作日时段划分
    if (timeInMinutes >= 360 && timeInMinutes < 420) { // 6:00-6:59
      return TIME_PERIODS.NORMAL
    } else if (timeInMinutes >= 420 && timeInMinutes < 1260) { // 7:00-20:59
      return TIME_PERIODS.LOW
    }
  } else if (dateType === DATE_TYPES.WEEKEND) {
    // 休息日时段划分
    if ((timeInMinutes >= 360 && timeInMinutes < 420) || // 6:00-6:59
        (timeInMinutes >= 840 && timeInMinutes < 900)) { // 14:00-14:59
      return TIME_PERIODS.PEAK
    } else if ((timeInMinutes >= 420 && timeInMinutes < 480) || // 7:00-7:59
               (timeInMinutes >= 540 && timeInMinutes < 720)) { // 9:00-11:59
      return TIME_PERIODS.NORMAL
    } else if ((timeInMinutes >= 480 && timeInMinutes < 540) || // 8:00-8:59
               (timeInMinutes >= 720 && timeInMinutes < 840) || // 12:00-13:59
               (timeInMinutes >= 900 && timeInMinutes < 1260)) { // 15:00-20:59
      return TIME_PERIODS.LOW
    }
  } else if (dateType === DATE_TYPES.HOLIDAY) {
    // 节假日时段划分
    if ((timeInMinutes >= 360 && timeInMinutes < 420) || // 6:00-6:59
        (timeInMinutes >= 840 && timeInMinutes < 900)) { // 14:00-14:59
      return TIME_PERIODS.PEAK
    } else if ((timeInMinutes >= 420 && timeInMinutes < 840) || // 7:00-13:59
               (timeInMinutes >= 900 && timeInMinutes < 1200)) { // 15:00-19:59
      return TIME_PERIODS.NORMAL
    } else if (timeInMinutes >= 1200 && timeInMinutes < 1260) { // 20:00-20:59
      return TIME_PERIODS.LOW
    }
  }
  
  // 默认返回平峰时段
  return TIME_PERIODS.NORMAL
}

/**
 * 获取提前购票天数对应的折扣键
 * @param {number} advanceDays 提前天数
 * @returns {number} 折扣键
 */
export function getAdvanceDaysKey(advanceDays) {
  if (advanceDays >= 10) return 10
  if (advanceDays >= 4) return 4
  return 1
}

/**
 * 计算复杂折扣
 * @param {number} originalPrice 原始价格
 * @param {Object} params 折扣参数
 * @param {string} params.priceFloatScenario 票价浮动情景
 * @param {string} params.departureDate 出发日期
 * @param {string} params.departureTime 发车时间
 * @param {number} params.advanceDays 提前购票天数
 * @param {string} params.travelTimeType 旅行时间类型
 * @returns {Object} 折扣结果
 */
export function calculateComplexDiscount(originalPrice, params) {
  const {
    priceFloatScenario = PRICE_FLOAT_SCENARIOS.FLOAT_10,
    departureDate,
    departureTime,
    advanceDays = 0,
    travelTimeType = TRAVEL_TIME_TYPES.K0
  } = params
  
  // 获取折扣表
  const discountTable = DISCOUNT_TABLES[priceFloatScenario]
  if (!discountTable) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discountRate: 1.0,
      discountInfo: '无折扣'
    }
  }
  
  // 自动判断日期类型
  const dateType = getDateTypeFromString(departureDate)
  
  // 自动判断时段
  const timePeriod = getTimePeriod(departureTime, dateType)
  
  // 获取提前购票天数键
  const advanceDaysKey = getAdvanceDaysKey(advanceDays)
  
  // 获取折扣率
  const discountRate = discountTable[dateType]?.[timePeriod]?.[travelTimeType]?.[advanceDaysKey]
  
  if (discountRate === undefined) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discountRate: 1.0,
      discountInfo: '无折扣'
    }
  }
  
  // 计算最终价格
  const finalPrice = originalPrice * discountRate
  
  // 生成折扣信息
  const discountPercent = Math.round((1 - discountRate) * 100)
  const discountInfo = discountRate < 1 ? `${discountPercent}%折扣` : `${Math.round((discountRate - 1) * 100)}%上浮`
  
  return {
    originalPrice,
    finalPrice: Math.round(finalPrice * 100) / 100,
    discountRate,
    discountInfo,
    details: {
      priceFloatScenario,
      dateType,
      timePeriod,
      advanceDays,
      travelTimeType,
      autoDetected: {
        dateType: `${dateType} (自动判断)`,
        timePeriod: `${timePeriod} (自动判断)`
      }
    }
  }
}

/**
 * 应用复杂折扣到票价列表
 * @param {Array} tickets 票价列表
 * @param {Object} discountParams 折扣参数
 * @returns {Array} 应用折扣后的票价列表
 */
export function applyComplexDiscountToTickets(tickets, discountParams) {
  return tickets.map(ticket => {
    // 自动从票价数据中提取发车时间
    const departureTime = ticket.departureTime || '08:00'
    
    const discountResult = calculateComplexDiscount(ticket.price, {
      ...discountParams,
      departureDate: discountParams.departureDate,
      departureTime: departureTime
    })
    
    return {
      ...ticket,
      originalPrice: discountResult.originalPrice,
      price: discountResult.finalPrice,
      discountRate: discountResult.discountRate,
      discountInfo: discountResult.discountInfo,
      discountDetails: discountResult.details
    }
  })
}

/**
 * 获取折扣信息描述
 * @param {Object} discountParams 折扣参数
 * @returns {string} 折扣信息描述
 */
export function getComplexDiscountInfo(discountParams) {
  const {
    priceFloatScenario = PRICE_FLOAT_SCENARIOS.FLOAT_10,
    travelTimeType = TRAVEL_TIME_TYPES.K0
  } = discountParams
  
  return `${priceFloatScenario} | ${travelTimeType}`
}
