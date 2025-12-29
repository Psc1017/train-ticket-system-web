/**
 * 复杂多因素折扣规则系统
 * 支持：出发日期、发车时段、提前购票、旅行时间、票价浮动情景
 */

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

// 旅行时间类型（K值）
export const TRAVEL_TIME_TYPES = {
  K1: 'K=1',  // 上浮55%
  K2: 'K=2',  // 上浮25%
  K3: 'K=3'   // 原价
}

// K=1时列车票价折扣表（上浮55%）
const DISCOUNT_TABLE_K1 = {
  [DATE_TYPES.WORKDAY]: {
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (6:00-6:59)
      3: 1.13, 9: 1.07, 10: 1.01
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (7:00-20:59)
      3: 1.06, 9: 1.01, 10: 0.95
    }
  },
  [DATE_TYPES.WEEKEND]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      3: 1.26, 9: 1.19, 10: 1.13
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-7:59、9:00-11:59)
      3: 1.19, 9: 1.13, 10: 1.07
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (8:00-8:59、12:00-13:59、15:00-20:59)
      3: 1.13, 9: 1.07, 10: 1.01
    }
  },
  [DATE_TYPES.HOLIDAY]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      3: 1.33, 9: 1.26, 10: 1.19
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-13:59、15:00-19:59)
      3: 1.26, 9: 1.19, 10: 1.13
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (20:00-20:59)
      3: 1.19, 9: 1.13, 10: 1.06
    }
  }
}

// K=2时列车票价折扣表（上浮25%）
const DISCOUNT_TABLE_K2 = {
  [DATE_TYPES.WORKDAY]: {
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (6:00-6:59)
      3: 0.91, 9: 0.86, 10: 0.81
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (7:00-20:59)
      3: 0.86, 9: 0.81, 10: 0.77
    }
  },
  [DATE_TYPES.WEEKEND]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      3: 1.02, 9: 0.96, 10: 0.91
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-7:59、9:00-11:59)
      3: 0.96, 9: 0.91, 10: 0.86
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (8:00-8:59、12:00-13:59、15:00-20:59)
      3: 0.91, 9: 0.86, 10: 0.81
    }
  },
  [DATE_TYPES.HOLIDAY]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      3: 1.07, 9: 1.02, 10: 0.96
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-13:59、15:00-19:59)
      3: 1.02, 9: 0.96, 10: 0.91
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (20:00-20:59)
      3: 0.96, 9: 0.91, 10: 0.86
    }
  }
}

// K=3时列车票价折扣表（原价）
const DISCOUNT_TABLE_K3 = {
  [DATE_TYPES.WORKDAY]: {
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (6:00-6:59)
      3: 0.73, 9: 0.69, 10: 0.65
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (7:00-20:59)
      3: 0.69, 9: 0.65, 10: 0.61
    }
  },
  [DATE_TYPES.WEEKEND]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      3: 0.81, 9: 0.77, 10: 0.73
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-7:59、9:00-11:59)
      3: 0.77, 9: 0.73, 10: 0.69
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (8:00-8:59、12:00-13:59、15:00-20:59)
      3: 0.73, 9: 0.69, 10: 0.65
    }
  },
  [DATE_TYPES.HOLIDAY]: {
    [TIME_PERIODS.PEAK]: { // 高峰时段 (6:00-6:59、14:00-14:59)
      3: 0.86, 9: 0.81, 10: 0.77
    },
    [TIME_PERIODS.NORMAL]: { // 平峰时段 (7:00-13:59、15:00-19:59)
      3: 0.81, 9: 0.77, 10: 0.73
    },
    [TIME_PERIODS.LOW]: { // 低谷时段 (20:00-20:59)
      3: 0.70, 9: 0.73, 10: 0.69
    }
  }
}

// 折扣表映射
const DISCOUNT_TABLES = {
  [TRAVEL_TIME_TYPES.K1]: DISCOUNT_TABLE_K1,
  [TRAVEL_TIME_TYPES.K2]: DISCOUNT_TABLE_K2,
  [TRAVEL_TIME_TYPES.K3]: DISCOUNT_TABLE_K3
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
 * @returns {number} 折扣键 (3: 1-3天, 9: 4-9天, 10: 10天及以上)
 */
export function getAdvanceDaysKey(advanceDays) {
  if (advanceDays >= 10) return 10
  if (advanceDays >= 4) return 9
  return 3
}

/**
 * 计算复杂折扣
 * @param {number} originalPrice 原始价格
 * @param {Object} params 折扣参数
 * @param {string} params.departureDate 出发日期
 * @param {string} params.departureTime 发车时间
 * @param {number} params.advanceDays 提前购票天数
 * @param {string} params.travelTimeType 旅行时间类型 (K1, K2, K3)
 * @returns {Object} 折扣结果
 */
export function calculateComplexDiscount(originalPrice, params) {
  const {
    departureDate,
    departureTime,
    advanceDays = 0,
    travelTimeType = TRAVEL_TIME_TYPES.K3  // 默认K3（原价）
  } = params
  
  // 获取折扣表
  const discountTable = DISCOUNT_TABLES[travelTimeType]
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
  const discountRate = discountTable[dateType]?.[timePeriod]?.[advanceDaysKey]
  
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
  const discountInfo = discountRate < 1 
    ? `${Math.abs(discountPercent)}%折扣` 
    : `${Math.round((discountRate - 1) * 100)}%上浮`
  
  return {
    originalPrice,
    finalPrice: Math.round(finalPrice * 100) / 100,
    discountRate,
    discountInfo,
    details: {
      dateType,
      timePeriod,
      advanceDays,
      travelTimeType,
      advanceDaysKey,
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
    // 自动按车次匹配 K 值（如未加载映射或未匹配到则回退为 K3）
    let resolvedK = undefined
    try {
      // 动态导入，防止循环依赖
      // eslint-disable-next-line no-undef
      const { getKForTrain, TRAVEL_TIME_TYPES: _T } = require('./trainKMap')
      resolvedK = getKForTrain?.(ticket.trainNumber)
      if (!resolvedK) {
        resolvedK = _T?.K3 || TRAVEL_TIME_TYPES.K3
      }
    } catch (e) {
      resolvedK = TRAVEL_TIME_TYPES.K3
    }

    const discountResult = calculateComplexDiscount(ticket.price, {
      ...discountParams,
      departureDate: discountParams.departureDate,
      departureTime: departureTime,
      travelTimeType: resolvedK
    })
    
    return {
      ...ticket,
      originalPrice: discountResult.originalPrice,
      price: discountResult.finalPrice,
      discountRate: discountResult.discountRate,
      discountInfo: discountResult.discountInfo,
      discountDetails: {
        ...discountResult.details,
        resolvedKFromTrainNumber: resolvedK,
      }
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
    travelTimeType = TRAVEL_TIME_TYPES.K3
  } = discountParams
  
  return travelTimeType
}
