import React, { useState, useEffect, useMemo } from 'react'
import { 
  Card, 
  Form, 
  Select, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Input,
  message,
  Statistic,
  Row,
  Col,
  Divider,
  Alert
} from 'antd'
import { 
  SearchOutlined, 
  RocketOutlined, 
  DollarOutlined,
  CalendarOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import dbManager from '../utils/indexedDB'
import { 
  loadTrainKValueMap, 
  applyNewDiscountToTickets,
  getDiscountDescription,
  calculateDiscountedPrice
} from '../utils/newDiscountRule'
import { smartSearch, formatDuration } from '../utils/transferSearch'

const { Option } = Select

// 席别价格系数（相对于二等座）
const SEAT_PRICE_RATIO = {
  '商务座': 3.5,
  '一等座': 1.8,
  '二等座': 1.0
}

function SearchTicket({ dbReady, refreshKey = 0 }) {
  const [form] = Form.useForm()
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [tickets, setTickets] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [participantId, setParticipantId] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [idInputValue, setIdInputValue] = useState('')
  
  // 当前选择的参数
  const [currentDateType, setCurrentDateType] = useState('workday')
  const [currentAdvanceDays, setCurrentAdvanceDays] = useState('1-3')
  
  // 每行选择的席别（key为车次唯一标识，value为席别）
  const [selectedSeats, setSelectedSeats] = useState({})

  // 中转相关状态
  const [searchType, setSearchType] = useState('direct') // 'direct' | 'transfer'
  const [transferTickets, setTransferTickets] = useState([])
  const [transferSelectedSeats, setTransferSelectedSeats] = useState({}) // 中转席别选择 { id: { first: '二等座', second: '二等座' } }

  // 预加载车次K值映射
  useEffect(() => { 
    loadTrainKValueMap()
  }, [])

  // 初始化参与者ID
  useEffect(() => {
    const savedId = localStorage.getItem('participantId')
    if (savedId) {
      setParticipantId(savedId)
      setIdInputValue(savedId)
    }
  }, [])

  // 保存参与者ID
  const handleSaveParticipantId = () => {
    if (idInputValue.trim()) {
      localStorage.setItem('participantId', idInputValue.trim())
      setParticipantId(idInputValue.trim())
      message.success('参与者编号已更新')
    } else {
      message.warning('请输入参与者编号')
    }
  }

  useEffect(() => {
    loadStations()
    loadStatistics()
  }, [dbReady, refreshKey])

  const loadStations = async () => {
    try {
      const data = await dbManager.getAllStations()
      setStations(data)
    } catch (error) {
      message.error('加载站点数据失败: ' + error.message)
    }
  }

  const loadStatistics = async () => {
    try {
      const stats = await dbManager.getStatistics()
      setStatistics(stats)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  // 原始查询结果（未应用折扣）
  const [rawTickets, setRawTickets] = useState([])

  /**
   * 合并同一车次的不同席别数据
   * 将商务座、一等座、二等座合并为一条记录，默认显示二等座价格
   */
  const mergeTicketsBySeatType = (ticketList, dateType, advanceDaysRange) => {
    // 按车次+出发站+到达站+出发时间+到达时间分组
    const groupedMap = new Map()
    
    ticketList.forEach(ticket => {
      // 创建唯一标识（同一车次、同一区间、同一时间）
      const key = `${ticket.trainNumber}_${ticket.fromStation}_${ticket.toStation}_${ticket.departureTime}_${ticket.arrivalTime}`
      
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          trainNumber: ticket.trainNumber,
          fromStation: ticket.fromStation,
          toStation: ticket.toStation,
          departureTime: ticket.departureTime,
          arrivalTime: ticket.arrivalTime,
          seats: {} // 存储各席别的价格信息
        })
      }
      
      const group = groupedMap.get(key)
      const seatType = ticket.seatType
      
      // 只处理商务座、一等座、二等座
      if (['商务座', '一等座', '二等座'].includes(seatType)) {
        group.seats[seatType] = {
          originalPrice: ticket.price,
          seatType: seatType
        }
      }
    })
    
    // 转换为数组，并为每条记录计算各席别的折扣价格
    const mergedTickets = []
    
    groupedMap.forEach((group, key) => {
      // 确保至少有二等座价格，如果没有则尝试根据其他席别推算
      let basePrice = null
      
      if (group.seats['二等座']) {
        basePrice = group.seats['二等座'].originalPrice
      } else if (group.seats['一等座']) {
        // 根据一等座推算二等座价格
        basePrice = group.seats['一等座'].originalPrice / SEAT_PRICE_RATIO['一等座']
      } else if (group.seats['商务座']) {
        // 根据商务座推算二等座价格
        basePrice = group.seats['商务座'].originalPrice / SEAT_PRICE_RATIO['商务座']
      }
      
      if (basePrice === null) {
        return // 跳过没有有效价格的记录
      }
      
      // 计算各席别价格
      const seatPrices = {}
      for (const seatType of ['商务座', '一等座', '二等座']) {
        if (group.seats[seatType]) {
          seatPrices[seatType] = group.seats[seatType].originalPrice
        } else {
          // 根据二等座价格推算
          seatPrices[seatType] = Math.round(basePrice * SEAT_PRICE_RATIO[seatType] * 100) / 100
        }
      }
      
      // 应用折扣计算（默认使用二等座）
      const discountResult = calculateDiscountedPrice(
        seatPrices['二等座'],
        group.trainNumber,
        group.departureTime,
        dateType,
        advanceDaysRange
      )
      
      mergedTickets.push({
        id: key,
        trainNumber: group.trainNumber,
        fromStation: group.fromStation,
        toStation: group.toStation,
        departureTime: group.departureTime,
        arrivalTime: group.arrivalTime,
        seatPrices: seatPrices, // 各席别原始价格
        currentSeatType: '二等座', // 默认席别
        price: discountResult.price, // 当前显示的折后价格（默认二等座）
        discountRate: discountResult.discountRate,
        discountInfo: discountResult.discountInfo,
        kValue: discountResult.kValue,
        dateType: discountResult.dateType,
        timePeriod: discountResult.timePeriod
      })
    })
    
    // 按出发时间排序
    mergedTickets.sort((a, b) => {
      const timeA = a.departureTime.replace(':', '')
      const timeB = b.departureTime.replace(':', '')
      return parseInt(timeA) - parseInt(timeB)
    })
    
    return mergedTickets
  }

  const handleSearch = async (values) => {
    setLoading(true)
    try {
      const fromStation = values.fromStation
      const toStation = values.toStation
      const dateType = values.dateType || 'workday'
      const advanceDaysRange = values.advanceDaysSelect || '1-3'
      
      setCurrentDateType(dateType)
      setCurrentAdvanceDays(advanceDaysRange)

      // 使用智能搜索：先搜直达，无直达则搜中转
      const searchResult = await smartSearch(fromStation, toStation)
      
      if (searchResult.type === 'direct') {
        // 直达模式
        setSearchType('direct')
        setTransferTickets([])
        
        // 保存原始结果
        setRawTickets(searchResult.results)

        // 合并同一车次的不同席别，并按出发时间排序
        const mergedTickets = mergeTicketsBySeatType(searchResult.results, dateType, advanceDaysRange)
        
        // 重置席别选择状态
        const initialSeats = {}
        mergedTickets.forEach(ticket => {
          initialSeats[ticket.id] = '二等座'
        })
        setSelectedSeats(initialSeats)
        
        setTickets(mergedTickets)
        message.success(`找到 ${mergedTickets.length} 个直达车次`)
      } else {
        // 中转模式
        setSearchType('transfer')
        setTickets([])
        setRawTickets([])
        
        // 处理中转结果，应用折扣
        const processedTransfers = processTransferTickets(searchResult.transferResults, dateType, advanceDaysRange)
        
        // 初始化中转席别选择
        const initialTransferSeats = {}
        processedTransfers.forEach(transfer => {
          initialTransferSeats[transfer.id] = { first: '二等座', second: '二等座' }
        })
        setTransferSelectedSeats(initialTransferSeats)
        
        setTransferTickets(processedTransfers)
        
        if (processedTransfers.length > 0) {
          message.info(`无直达车次，找到 ${processedTransfers.length} 个中转方案`)
        } else {
          message.warning('未找到直达或中转车次')
        }
      }
    } catch (error) {
      message.error('查询失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 处理中转车票数据，合并席别并计算折扣
   */
  const processTransferTickets = (transferResults, dateType, advanceDaysRange) => {
    // 按中转方案分组（第一程车次+中转站+第二程车次）
    const groupedMap = new Map()
    
    transferResults.forEach(transfer => {
      const key = `${transfer.firstLeg.trainNumber}_${transfer.viaStation}_${transfer.secondLeg.trainNumber}_${transfer.firstLeg.departureTime}_${transfer.secondLeg.departureTime}`
      
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...transfer,
          firstLegSeats: {},
          secondLegSeats: {}
        })
      }
      
      const group = groupedMap.get(key)
      const firstSeatType = transfer.firstLeg.seatType
      const secondSeatType = transfer.secondLeg.seatType
      
      // 收集第一程各席别价格
      if (['商务座', '一等座', '二等座'].includes(firstSeatType)) {
        group.firstLegSeats[firstSeatType] = transfer.firstLeg.price
      }
      
      // 收集第二程各席别价格
      if (['商务座', '一等座', '二等座'].includes(secondSeatType)) {
        group.secondLegSeats[secondSeatType] = transfer.secondLeg.price
      }
    })
    
    // 转换为数组并计算折扣价格
    const processedTransfers = []
    
    groupedMap.forEach((group, key) => {
      // 确保有二等座价格，如果没有则推算
      const firstBasePrice = group.firstLegSeats['二等座'] || 
        (group.firstLegSeats['一等座'] ? group.firstLegSeats['一等座'] / SEAT_PRICE_RATIO['一等座'] : null) ||
        (group.firstLegSeats['商务座'] ? group.firstLegSeats['商务座'] / SEAT_PRICE_RATIO['商务座'] : null)
      
      const secondBasePrice = group.secondLegSeats['二等座'] || 
        (group.secondLegSeats['一等座'] ? group.secondLegSeats['一等座'] / SEAT_PRICE_RATIO['一等座'] : null) ||
        (group.secondLegSeats['商务座'] ? group.secondLegSeats['商务座'] / SEAT_PRICE_RATIO['商务座'] : null)
      
      if (!firstBasePrice || !secondBasePrice) return
      
      // 计算各席别价格
      const firstSeatPrices = {}
      const secondSeatPrices = {}
      
      for (const seatType of ['商务座', '一等座', '二等座']) {
        firstSeatPrices[seatType] = group.firstLegSeats[seatType] || 
          Math.round(firstBasePrice * SEAT_PRICE_RATIO[seatType] * 100) / 100
        secondSeatPrices[seatType] = group.secondLegSeats[seatType] || 
          Math.round(secondBasePrice * SEAT_PRICE_RATIO[seatType] * 100) / 100
      }
      
      // 计算第一程折扣（默认二等座）
      const firstDiscount = calculateDiscountedPrice(
        firstSeatPrices['二等座'],
        group.firstLeg.trainNumber,
        group.firstLeg.departureTime,
        dateType,
        advanceDaysRange
      )
      
      // 计算第二程折扣（默认二等座）
      const secondDiscount = calculateDiscountedPrice(
        secondSeatPrices['二等座'],
        group.secondLeg.trainNumber,
        group.secondLeg.departureTime,
        dateType,
        advanceDaysRange
      )
      
      processedTransfers.push({
        id: key,
        viaStation: group.viaStation,
        waitTime: group.waitTime,
        waitTimeFormatted: group.waitTimeFormatted,
        totalTime: group.totalTime,
        totalTimeFormatted: group.totalTimeFormatted,
        // 第一程信息
        firstLeg: {
          trainNumber: group.firstLeg.trainNumber,
          fromStation: group.firstLeg.fromStation,
          toStation: group.firstLeg.toStation,
          departureTime: group.firstLeg.departureTime,
          arrivalTime: group.firstLeg.arrivalTime,
          seatPrices: firstSeatPrices,
          currentSeatType: '二等座',
          price: firstDiscount.price,
          discountRate: firstDiscount.discountRate,
          discountInfo: firstDiscount.discountInfo,
          kValue: firstDiscount.kValue
        },
        // 第二程信息
        secondLeg: {
          trainNumber: group.secondLeg.trainNumber,
          fromStation: group.secondLeg.fromStation,
          toStation: group.secondLeg.toStation,
          departureTime: group.secondLeg.departureTime,
          arrivalTime: group.secondLeg.arrivalTime,
          seatPrices: secondSeatPrices,
          currentSeatType: '二等座',
          price: secondDiscount.price,
          discountRate: secondDiscount.discountRate,
          discountInfo: secondDiscount.discountInfo,
          kValue: secondDiscount.kValue
        },
        // 总价
        totalPrice: firstDiscount.price + secondDiscount.price
      })
    })
    
    // 按第一程出发时间排序
    processedTransfers.sort((a, b) => {
      const timeA = a.firstLeg.departureTime.replace(':', '')
      const timeB = b.firstLeg.departureTime.replace(':', '')
      return parseInt(timeA) - parseInt(timeB)
    })
    
    return processedTransfers
  }

  // 处理中转席别切换
  const handleTransferSeatChange = (transferId, leg, seatType) => {
    setTransferSelectedSeats(prev => ({
      ...prev,
      [transferId]: {
        ...prev[transferId],
        [leg]: seatType
      }
    }))
    
    // 更新对应中转方案的价格
    setTransferTickets(prevTransfers => {
      return prevTransfers.map(transfer => {
        if (transfer.id === transferId) {
          const updatedTransfer = { ...transfer }
          
          if (leg === 'first') {
            const newPrice = transfer.firstLeg.seatPrices[seatType]
            const discountResult = calculateDiscountedPrice(
              newPrice,
              transfer.firstLeg.trainNumber,
              transfer.firstLeg.departureTime,
              currentDateType,
              currentAdvanceDays
            )
            updatedTransfer.firstLeg = {
              ...transfer.firstLeg,
              currentSeatType: seatType,
              price: discountResult.price,
              discountRate: discountResult.discountRate,
              discountInfo: discountResult.discountInfo
            }
          } else {
            const newPrice = transfer.secondLeg.seatPrices[seatType]
            const discountResult = calculateDiscountedPrice(
              newPrice,
              transfer.secondLeg.trainNumber,
              transfer.secondLeg.departureTime,
              currentDateType,
              currentAdvanceDays
            )
            updatedTransfer.secondLeg = {
              ...transfer.secondLeg,
              currentSeatType: seatType,
              price: discountResult.price,
              discountRate: discountResult.discountRate,
              discountInfo: discountResult.discountInfo
            }
          }
          
          // 更新总价
          updatedTransfer.totalPrice = updatedTransfer.firstLeg.price + updatedTransfer.secondLeg.price
          
          return updatedTransfer
        }
        return transfer
      })
    })
  }

  // 购买中转票（第一程或第二程）
  const handleTransferPurchase = async (transfer, leg) => {
    if (!participantId) {
      message.error('请先设置参与者编号')
      return
    }

    setPurchasing(true)
    
    try {
      const ticket = leg === 'first' ? transfer.firstLeg : transfer.secondLeg
      const seatType = transferSelectedSeats[transfer.id]?.[leg] || '二等座'
      
      const purchaseData = {
        participantId: participantId,
        trainNumber: ticket.trainNumber,
        fromStation: ticket.fromStation,
        toStation: ticket.toStation,
        departureTime: ticket.departureTime,
        arrivalTime: ticket.arrivalTime,
        originalPrice: ticket.seatPrices[seatType],
        finalPrice: ticket.price,
        discountRate: ticket.discountRate || 1,
        discountInfo: ticket.discountInfo || '无折扣',
        kValue: ticket.kValue,
        dateType: currentDateType,
        timePeriod: ticket.timePeriod,
        advanceDays: currentAdvanceDays,
        seatType: seatType,
        isTransfer: true,
        transferLeg: leg === 'first' ? '第一程' : '第二程',
        viaStation: transfer.viaStation
      }

      await dbManager.savePurchase(purchaseData)
      message.success(`${leg === 'first' ? '第一程' : '第二程'}购票成功！票价: ¥${ticket.price.toFixed(2)}`)
    } catch (error) {
      message.error('购票失败: ' + error.message)
    } finally {
      setPurchasing(false)
    }
  }

  // 当日期类型或提前天数改变时，重新计算折扣
  const handleDateTypeChange = (value) => {
    setCurrentDateType(value)
    form.setFieldValue('dateType', value)
    
    if (searchType === 'direct' && rawTickets.length > 0) {
      const mergedTickets = mergeTicketsBySeatType(rawTickets, value, currentAdvanceDays)
      // 保持之前的席别选择
      mergedTickets.forEach(ticket => {
        const prevSeat = selectedSeats[ticket.id]
        if (prevSeat && ticket.seatPrices[prevSeat]) {
          const discountResult = calculateDiscountedPrice(
            ticket.seatPrices[prevSeat],
            ticket.trainNumber,
            ticket.departureTime,
            value,
            currentAdvanceDays
          )
          ticket.currentSeatType = prevSeat
          ticket.price = discountResult.price
          ticket.discountRate = discountResult.discountRate
          ticket.discountInfo = discountResult.discountInfo
        }
      })
      setTickets(mergedTickets)
    } else if (searchType === 'transfer' && transferTickets.length > 0) {
      // 重新计算中转票价折扣
      updateTransferDiscounts(value, currentAdvanceDays)
    }
  }

  const handleAdvanceDaysSelectChange = (value) => {
    setCurrentAdvanceDays(value)
    form.setFieldValue('advanceDaysSelect', value)
    
    if (searchType === 'direct' && rawTickets.length > 0) {
      const mergedTickets = mergeTicketsBySeatType(rawTickets, currentDateType, value)
      // 保持之前的席别选择
      mergedTickets.forEach(ticket => {
        const prevSeat = selectedSeats[ticket.id]
        if (prevSeat && ticket.seatPrices[prevSeat]) {
          const discountResult = calculateDiscountedPrice(
            ticket.seatPrices[prevSeat],
            ticket.trainNumber,
            ticket.departureTime,
            currentDateType,
            value
          )
          ticket.currentSeatType = prevSeat
          ticket.price = discountResult.price
          ticket.discountRate = discountResult.discountRate
          ticket.discountInfo = discountResult.discountInfo
        }
      })
      setTickets(mergedTickets)
    } else if (searchType === 'transfer' && transferTickets.length > 0) {
      // 重新计算中转票价折扣
      updateTransferDiscounts(currentDateType, value)
    }
  }

  // 更新中转票价折扣
  const updateTransferDiscounts = (dateType, advanceDays) => {
    setTransferTickets(prevTransfers => {
      return prevTransfers.map(transfer => {
        const firstSeatType = transferSelectedSeats[transfer.id]?.first || '二等座'
        const secondSeatType = transferSelectedSeats[transfer.id]?.second || '二等座'
        
        const firstDiscount = calculateDiscountedPrice(
          transfer.firstLeg.seatPrices[firstSeatType],
          transfer.firstLeg.trainNumber,
          transfer.firstLeg.departureTime,
          dateType,
          advanceDays
        )
        
        const secondDiscount = calculateDiscountedPrice(
          transfer.secondLeg.seatPrices[secondSeatType],
          transfer.secondLeg.trainNumber,
          transfer.secondLeg.departureTime,
          dateType,
          advanceDays
        )
        
        return {
          ...transfer,
          firstLeg: {
            ...transfer.firstLeg,
            price: firstDiscount.price,
            discountRate: firstDiscount.discountRate,
            discountInfo: firstDiscount.discountInfo
          },
          secondLeg: {
            ...transfer.secondLeg,
            price: secondDiscount.price,
            discountRate: secondDiscount.discountRate,
            discountInfo: secondDiscount.discountInfo
          },
          totalPrice: firstDiscount.price + secondDiscount.price
        }
      })
    })
  }

  // 处理席别切换
  const handleSeatChange = (ticketId, seatType) => {
    setSelectedSeats(prev => ({
      ...prev,
      [ticketId]: seatType
    }))
    
    // 更新对应车次的价格
    setTickets(prevTickets => {
      return prevTickets.map(ticket => {
        if (ticket.id === ticketId) {
          const newPrice = ticket.seatPrices[seatType]
          const discountResult = calculateDiscountedPrice(
            newPrice,
            ticket.trainNumber,
            ticket.departureTime,
            currentDateType,
            currentAdvanceDays
          )
          return {
            ...ticket,
            currentSeatType: seatType,
            price: discountResult.price,
            discountRate: discountResult.discountRate,
            discountInfo: discountResult.discountInfo
          }
        }
        return ticket
      })
    })
  }

  const handlePurchase = async (ticket) => {
    if (!participantId) {
      message.error('请先设置参与者编号')
      return
    }

    setPurchasing(true)
    
    try {
      const purchaseData = {
        participantId: participantId,
        trainNumber: ticket.trainNumber,
        fromStation: ticket.fromStation,
        toStation: ticket.toStation,
        departureTime: ticket.departureTime,
        arrivalTime: ticket.arrivalTime,
        originalPrice: ticket.originalPrice || ticket.price,
        finalPrice: ticket.price,
        discountRate: ticket.discountRate || 1,
        discountInfo: ticket.discountInfo || '无折扣',
        kValue: ticket.kValue,
        dateType: ticket.dateType,
        timePeriod: ticket.timePeriod,
        advanceDays: currentAdvanceDays,
        seatType: ticket.seatType
      }

      await dbManager.savePurchase(purchaseData)
      message.success(`购票成功！票价: ¥${ticket.price.toFixed(2)}`)
    } catch (error) {
      message.error('购票失败: ' + error.message)
    } finally {
      setPurchasing(false)
    }
  }

  const columns = [
    {
      title: '车次',
      dataIndex: 'trainNumber',
      key: 'trainNumber',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue"><RocketOutlined /> {text}</Tag>
          <Tag color={record.kValue === 1 ? 'red' : record.kValue === 2 ? 'orange' : 'green'} style={{ fontSize: '10px' }}>
            K={record.kValue}
          </Tag>
        </Space>
      )
    },
    {
      title: '出发站',
      dataIndex: 'fromStation',
      key: 'fromStation',
    },
    {
      title: '到达站',
      dataIndex: 'toStation',
      key: 'toStation',
    },
    {
      title: '发车时间',
      dataIndex: 'departureTime',
      key: 'departureTime',
    },
    {
      title: '到达时间',
      dataIndex: 'arrivalTime',
      key: 'arrivalTime',
    },
    {
      title: '席别',
      dataIndex: 'currentSeatType',
      key: 'seatType',
      width: 120,
      render: (text, record) => (
        <Select
          value={selectedSeats[record.id] || '二等座'}
          onChange={(value) => handleSeatChange(record.id, value)}
          size="small"
          style={{ width: 100 }}
        >
          <Option value="商务座">商务座</Option>
          <Option value="一等座">一等座</Option>
          <Option value="二等座">二等座</Option>
        </Select>
      )
    },
    {
      title: '折后票价',
      dataIndex: 'price',
      key: 'price',
      render: (price, record) => {
        const isDiscount = record.discountRate < 1
        const color = isDiscount ? '#52c41a' : '#f5222d'
        return (
          <span style={{ fontSize: '16px', fontWeight: 'bold', color }}>
            <DollarOutlined /> ¥{price.toFixed(2)}
          </span>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<ShoppingCartOutlined />}
          onClick={() => handlePurchase(record)}
          loading={purchasing}
        >
          购票
        </Button>
      )
    }
  ]

  // 获取日期类型标签
  const getDateTypeLabel = (type) => {
    const labels = { workday: '工作日', weekend: '休息日', holiday: '节假日' }
    return labels[type] || type
  }

  // 渲染中转方案卡片
  const renderTransferCard = (transfer) => {
    const firstSeat = transferSelectedSeats[transfer.id]?.first || '二等座'
    const secondSeat = transferSelectedSeats[transfer.id]?.second || '二等座'
    
    return (
      <Card 
        key={transfer.id} 
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: 16 }}
      >
        {/* 中转概览 */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Tag color="orange" style={{ fontSize: '14px' }}>
              <SwapOutlined /> 中转换乘
            </Tag>
            <span style={{ fontWeight: 'bold' }}>
              {transfer.firstLeg.fromStation} → <span style={{ color: '#fa8c16' }}>{transfer.viaStation}</span> → {transfer.secondLeg.toStation}
            </span>
          </Space>
          <Space>
            <Tag color="blue">
              <ClockCircleOutlined /> 换乘等待: {transfer.waitTimeFormatted}
            </Tag>
            <Tag color="purple">
              总耗时: {transfer.totalTimeFormatted}
            </Tag>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
              总价: ¥{transfer.totalPrice.toFixed(2)}
            </span>
          </Space>
        </div>
        
        <Divider style={{ margin: '12px 0' }} />
        
        {/* 第一程 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Tag color="green">第一程</Tag>
          </div>
          <Row gutter={16} align="middle">
            <Col span={3}>
              <Space direction="vertical" size={0}>
                <Tag color="blue"><RocketOutlined /> {transfer.firstLeg.trainNumber}</Tag>
                <Tag color={transfer.firstLeg.kValue === 1 ? 'red' : transfer.firstLeg.kValue === 2 ? 'orange' : 'green'} style={{ fontSize: '10px' }}>
                  K={transfer.firstLeg.kValue}
                </Tag>
              </Space>
            </Col>
            <Col span={3}>{transfer.firstLeg.fromStation}</Col>
            <Col span={3}>{transfer.firstLeg.toStation}</Col>
            <Col span={3}>{transfer.firstLeg.departureTime}</Col>
            <Col span={3}>{transfer.firstLeg.arrivalTime}</Col>
            <Col span={3}>
              <Select
                value={firstSeat}
                onChange={(value) => handleTransferSeatChange(transfer.id, 'first', value)}
                size="small"
                style={{ width: 100 }}
              >
                <Option value="商务座">商务座</Option>
                <Option value="一等座">一等座</Option>
                <Option value="二等座">二等座</Option>
              </Select>
            </Col>
            <Col span={3}>
              <span style={{ 
                fontSize: '16px', 
                fontWeight: 'bold', 
                color: transfer.firstLeg.discountRate < 1 ? '#52c41a' : '#f5222d' 
              }}>
                ¥{transfer.firstLeg.price.toFixed(2)}
              </span>
            </Col>
            <Col span={3}>
              <Button
                type="primary"
                size="small"
                icon={<ShoppingCartOutlined />}
                onClick={() => handleTransferPurchase(transfer, 'first')}
                loading={purchasing}
              >
                购票
              </Button>
            </Col>
          </Row>
        </div>
        
        {/* 第二程 */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <Tag color="cyan">第二程</Tag>
          </div>
          <Row gutter={16} align="middle">
            <Col span={3}>
              <Space direction="vertical" size={0}>
                <Tag color="blue"><RocketOutlined /> {transfer.secondLeg.trainNumber}</Tag>
                <Tag color={transfer.secondLeg.kValue === 1 ? 'red' : transfer.secondLeg.kValue === 2 ? 'orange' : 'green'} style={{ fontSize: '10px' }}>
                  K={transfer.secondLeg.kValue}
                </Tag>
              </Space>
            </Col>
            <Col span={3}>{transfer.secondLeg.fromStation}</Col>
            <Col span={3}>{transfer.secondLeg.toStation}</Col>
            <Col span={3}>{transfer.secondLeg.departureTime}</Col>
            <Col span={3}>{transfer.secondLeg.arrivalTime}</Col>
            <Col span={3}>
              <Select
                value={secondSeat}
                onChange={(value) => handleTransferSeatChange(transfer.id, 'second', value)}
                size="small"
                style={{ width: 100 }}
              >
                <Option value="商务座">商务座</Option>
                <Option value="一等座">一等座</Option>
                <Option value="二等座">二等座</Option>
              </Select>
            </Col>
            <Col span={3}>
              <span style={{ 
                fontSize: '16px', 
                fontWeight: 'bold', 
                color: transfer.secondLeg.discountRate < 1 ? '#52c41a' : '#f5222d' 
              }}>
                ¥{transfer.secondLeg.price.toFixed(2)}
              </span>
            </Col>
            <Col span={3}>
              <Button
                type="primary"
                size="small"
                icon={<ShoppingCartOutlined />}
                onClick={() => handleTransferPurchase(transfer, 'second')}
                loading={purchasing}
              >
                购票
              </Button>
            </Col>
          </Row>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <Card style={{ marginBottom: 16, background: '#f0f9ff' }} bodyStyle={{ padding: 12 }}>
        <Space size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            {participantId ? (
              <>
                <span><strong>当前参与者编号:</strong></span>
                <Tag color="blue" style={{ fontSize: '14px' }}>{participantId}</Tag>
              </>
            ) : (
              <span style={{ color: '#ff4d4f' }}>⚠️ 请先设置参与者编号</span>
            )}
          </Space>
          
          <Space wrap>
            <Input
              placeholder="输入参与者编号（如：张三、P001）"
              value={idInputValue}
              onChange={(e) => setIdInputValue(e.target.value)}
              style={{ width: 250 }}
              size="small"
            />
            <Button 
              type="primary" 
              size="small"
              onClick={handleSaveParticipantId}
            >
              保存
            </Button>
          </Space>
        </Space>
      </Card>
      
      <Card style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{
            dateType: 'workday',
            advanceDaysSelect: '1-3'
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={5}>
              <Form.Item
                label="出发站"
                name="fromStation"
                rules={[{ required: true, message: '请选择出发站' }]}
              >
                <Select 
                  placeholder="请选择出发站"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {stations.map(station => (
                    <Option key={station.name} value={station.name}>
                      {station.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Form.Item
                label="到达站"
                name="toStation"
                rules={[{ required: true, message: '请选择到达站' }]}
              >
                <Select 
                  placeholder="请选择到达站"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {stations.map(station => (
                    <Option key={station.name} value={station.name}>
                      {station.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={3}>
              <Form.Item
                label="日期类型"
                name="dateType"
              >
                <Select 
                  style={{ width: '100%' }}
                  onChange={handleDateTypeChange}
                >
                  <Option value="workday">工作日</Option>
                  <Option value="weekend">休息日</Option>
                  <Option value="holiday">节假日</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item
                label="提前购票天数"
                name="advanceDaysSelect"
              >
                <Select 
                  style={{ width: '100%' }}
                  onChange={handleAdvanceDaysSelectChange}
                >
                  <Option value="1-3">提前1-3天</Option>
                  <Option value="4-9">提前4-9天</Option>
                  <Option value="10+">提前10天及以上</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item label=" ">
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SearchOutlined />}
                  loading={loading}
                  style={{ width: '100%' }}
                  size="large"
                >
                  查询票价
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* 直达结果统计 */}
      {searchType === 'direct' && tickets.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="当前设置" 
                value={getDateTypeLabel(currentDateType)}
                prefix={<CalendarOutlined />}
                suffix={getDiscountDescription(currentAdvanceDays)}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="直达车次" 
                value={tickets.length}
                suffix="条"
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="最低票价" 
                value={Math.min(...tickets.map(t => t.price))}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="平均票价" 
                value={tickets.reduce((sum, t) => sum + t.price, 0) / tickets.length}
                prefix="¥"
                precision={2}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 中转结果统计 */}
      {searchType === 'transfer' && transferTickets.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Alert 
            message="无直达车次，以下为中转换乘方案" 
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="当前设置" 
                value={getDateTypeLabel(currentDateType)}
                prefix={<CalendarOutlined />}
                suffix={getDiscountDescription(currentAdvanceDays)}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="中转方案" 
                value={transferTickets.length}
                prefix={<SwapOutlined />}
                suffix="条"
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="最低总价" 
                value={Math.min(...transferTickets.map(t => t.totalPrice))}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="平均总价" 
                value={transferTickets.reduce((sum, t) => sum + t.totalPrice, 0) / transferTickets.length}
                prefix="¥"
                precision={2}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 直达结果表格 */}
      {searchType === 'direct' && tickets.length > 0 && (
        <Card title="直达车次">
          <Table 
            columns={columns} 
            dataSource={tickets}
            loading={loading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条结果`
            }}
          />
        </Card>
      )}

      {/* 中转结果列表 */}
      {searchType === 'transfer' && transferTickets.length > 0 && (
        <Card 
          title={
            <Space>
              <SwapOutlined />
              <span>中转换乘方案</span>
              <Tag color="orange">{transferTickets.length} 个方案</Tag>
            </Space>
          }
        >
          <div style={{ marginBottom: 12 }}>
            <Row gutter={16} style={{ fontWeight: 'bold', color: '#666', fontSize: '12px', padding: '0 16px' }}>
              <Col span={3}>车次</Col>
              <Col span={3}>出发站</Col>
              <Col span={3}>到达站</Col>
              <Col span={3}>发车时间</Col>
              <Col span={3}>到达时间</Col>
              <Col span={3}>席别</Col>
              <Col span={3}>折后票价</Col>
              <Col span={3}>操作</Col>
            </Row>
          </div>
          {transferTickets.map(transfer => renderTransferCard(transfer))}
        </Card>
      )}

      {statistics && tickets.length === 0 && transferTickets.length === 0 && (
        <Card>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic 
                title="数据库总票数" 
                value={statistics.totalTickets}
                prefix={<DollarOutlined />}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="站点总数" 
                value={stations.length}
                prefix={<RocketOutlined />}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  )
}

export default SearchTicket
