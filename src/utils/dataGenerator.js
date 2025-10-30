/**
 * 示例数据生成器
 * 用于生成测试用的高铁票价数据
 */

// 主要站点列表
const STATIONS = [
  '北京南', '北京西', '北京北',
  '上海虹桥', '上海', '上海南',
  '广州南', '深圳北', '深圳',
  '杭州东', '杭州', '杭州南',
  '南京南', '南京', '南京西',
  '武汉', '汉口', '武昌',
  '成都东', '成都南', '成都',
  '西安北', '西安', '西安南',
  '重庆北', '重庆西', '重庆',
  '天津', '天津南', '天津西',
  '济南西', '济南', '济南东',
  '郑州东', '郑州', '郑州西',
  '长沙南', '长沙', '长沙西',
  '南昌', '南昌西', '南昌东',
  '福州', '福州南', '福州西',
  '厦门北', '厦门', '厦门西'
]

// 车次前缀
const TRAIN_PREFIXES = ['G', 'D', 'C']

// 席别类型
const SEAT_TYPES = ['商务座', '一等座', '二等座', '软卧', '硬卧', '硬座']

// 生成随机车次号
function generateTrainNumber() {
  const prefix = TRAIN_PREFIXES[Math.floor(Math.random() * TRAIN_PREFIXES.length)]
  const number = Math.floor(Math.random() * 1000) + 1
  return `${prefix}${number.toString().padStart(3, '0')}`
}

// 生成随机时间
function generateTime() {
  const hours = Math.floor(Math.random() * 24)
  const minutes = Math.floor(Math.random() * 4) * 15 // 0, 15, 30, 45
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// 生成票价（基于距离估算）
function generatePrice(fromStation, toStation, seatType) {
  // 简化的票价计算逻辑
  const distance = Math.abs(STATIONS.indexOf(fromStation) - STATIONS.indexOf(toStation)) || 1
  const basePrice = distance * 15
  
  // 不同席别的价格系数
  const seatMultipliers = {
    '商务座': 3.5,
    '一等座': 1.8,
    '二等座': 1.0,
    '软卧': 2.2,
    '硬卧': 1.5,
    '硬座': 0.8
  }
  
  const multiplier = seatMultipliers[seatType] || 1.0
  const price = basePrice * multiplier
  
  // 添加一些随机波动
  const randomFactor = 0.9 + Math.random() * 0.2
  return Math.round(price * randomFactor * 100) / 100
}

// 生成单个票价记录
function generateTicket() {
  const fromIndex = Math.floor(Math.random() * STATIONS.length)
  let toIndex = Math.floor(Math.random() * STATIONS.length)
  
  // 确保出发站和到达站不同
  while (toIndex === fromIndex) {
    toIndex = Math.floor(Math.random() * STATIONS.length)
  }
  
  const fromStation = STATIONS[fromIndex]
  const toStation = STATIONS[toIndex]
  const seatType = SEAT_TYPES[Math.floor(Math.random() * SEAT_TYPES.length)]
  
  const departureTime = generateTime()
  const arrivalTime = generateTime()
  
  const ticket = {
    trainNumber: generateTrainNumber(),
    fromStation,
    toStation,
    departureTime,
    arrivalTime,
    price: generatePrice(fromStation, toStation, seatType),
    seatType
  }
  
  return ticket
}

// 批量生成示例数据
export function generateSampleData(count) {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push(generateTicket())
  }
  return data
}

// 生成站点数据
export function generateStationsData() {
  return STATIONS.map((name, index) => ({
    name,
    code: `STA${index.toString().padStart(4, '0')}`,
    city: name.replace(/[北南东西]/, ''), // 简化处理
    province: '待分配'
  }))
}

export { STATIONS, TRAIN_PREFIXES, SEAT_TYPES }

