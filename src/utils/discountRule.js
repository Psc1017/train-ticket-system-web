/**
 * 票价折扣规则
 * 根据提前购票天数应用不同的折扣
 */

// 默认折扣规则：提前购票天数对应的折扣率
const DISCOUNT_RULES = {
  0: 1.0,   // 当日购票：无折扣
  1: 0.98,  // 提前1天：98折
  2: 0.96,  // 提前2天：96折
  3: 0.94,  // 提前3天：94折
  7: 0.90,  // 提前7天：90折
  14: 0.85, // 提前14天：85折
  30: 0.80, // 提前30天：80折
  60: 0.75  // 提前60天：75折
}

/**
 * 根据提前购票天数获取折扣率
 * @param {number} advanceDays - 提前购票天数
 * @returns {number} 折扣率
 */
export function getDiscountRate(advanceDays) {
  // 找到最接近的折扣规则
  const sortedDays = Object.keys(DISCOUNT_RULES)
    .map(Number)
    .sort((a, b) => a - b)
  
  // 找到小于等于advanceDays的最大值
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (advanceDays >= sortedDays[i]) {
      return DISCOUNT_RULES[sortedDays[i]]
    }
  }
  
  return DISCOUNT_RULES[0] // 默认为无折扣
}

/**
 * 应用折扣计算最终票价
 * @param {number} originalPrice - 原始票价
 * @param {number} advanceDays - 提前购票天数
 * @returns {number} 折扣后的票价
 */
export function applyDiscount(originalPrice, advanceDays) {
  const discountRate = getDiscountRate(advanceDays)
  const discountedPrice = originalPrice * discountRate
  return Math.round(discountedPrice * 100) / 100 // 保留两位小数
}

/**
 * 获取折扣说明
 * @param {number} advanceDays - 提前购票天数
 * @returns {string} 折扣说明
 */
export function getDiscountInfo(advanceDays) {
  const discountRate = getDiscountRate(advanceDays)
  const percentage = Math.round((1 - discountRate) * 100)
  
  if (percentage === 0) {
    return '无折扣'
  }
  
  return `${percentage}%折扣`
}

/**
 * 应用折扣到票价数据
 * @param {Array} tickets - 票价数组
 * @param {number} advanceDays - 提前购票天数
 * @returns {Array} 应用折扣后的票价数组
 */
export function applyDiscountToTickets(tickets, advanceDays) {
  return tickets.map(ticket => ({
    ...ticket,
    originalPrice: ticket.price,
    price: applyDiscount(ticket.price, advanceDays),
    discountInfo: getDiscountInfo(advanceDays),
    discountRate: getDiscountRate(advanceDays)
  }))
}

export { DISCOUNT_RULES }

