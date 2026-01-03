import React, { useState, useEffect } from 'react'
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
  Radio
} from 'antd'
import { 
  SearchOutlined, 
  RocketOutlined, 
  DollarOutlined,
  CalendarOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons'
import dbManager from '../utils/indexedDB'
import { 
  loadTrainKValueMap, 
  applyNewDiscountToTickets,
  getDiscountDescription,
  calculateDiscountedPrice
} from '../utils/newDiscountRule'

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
  
  // 搜索模式：fuzzy（模糊搜索）或 exact（精确搜索）
  const [searchMode, setSearchMode] = useState('fuzzy')
  
  // 每行选择的席别（key为车次唯一标识，value为席别）
  const [selectedSeats, setSelectedSeats] = useState({})

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

      let results
      if (searchMode === 'fuzzy') {
        // 模糊搜索：匹配包含关键词的站点
        results = await dbManager.searchTicketsFuzzy(
          fromStation, 
          toStation,
          { limit: 5000 }
        )
      } else {
        // 精确搜索：完全匹配站点名称
        results = await dbManager.searchTickets(
          fromStation, 
          toStation,
          { limit: 5000 }
        )
      }

      // 保存原始结果
      setRawTickets(results)

      // 合并同一车次的不同席别，并按出发时间排序
      const mergedTickets = mergeTicketsBySeatType(results, dateType, advanceDaysRange)
      
      // 重置席别选择状态
      const initialSeats = {}
      mergedTickets.forEach(ticket => {
        initialSeats[ticket.id] = '二等座'
      })
      setSelectedSeats(initialSeats)
      
      setTickets(mergedTickets)

      const modeText = searchMode === 'fuzzy' ? '模糊搜索' : '精确搜索'
      message.success(`${modeText}找到 ${mergedTickets.length} 个车次`)
    } catch (error) {
      message.error('查询失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 当日期类型或提前天数改变时，重新计算折扣
  const handleDateTypeChange = (value) => {
    setCurrentDateType(value)
    form.setFieldValue('dateType', value)
    
    if (rawTickets.length > 0) {
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
    }
  }

  const handleAdvanceDaysSelectChange = (value) => {
    setCurrentAdvanceDays(value)
    form.setFieldValue('advanceDaysSelect', value)
    
    if (rawTickets.length > 0) {
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
    }
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
      width: 200,
      render: (text, record) => (
        <Radio.Group 
          value={selectedSeats[record.id] || '二等座'}
          onChange={(e) => handleSeatChange(record.id, e.target.value)}
          size="small"
        >
          <Radio.Button value="商务座">商务座</Radio.Button>
          <Radio.Button value="一等座">一等座</Radio.Button>
          <Radio.Button value="二等座">二等座</Radio.Button>
        </Radio.Group>
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
                label="搜索模式"
              >
                <Radio.Group 
                  value={searchMode} 
                  onChange={(e) => setSearchMode(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="fuzzy">模糊</Radio.Button>
                  <Radio.Button value="exact">精确</Radio.Button>
                </Radio.Group>
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

      {tickets.length > 0 && (
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
                title="查询结果" 
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

      {tickets.length > 0 && (
        <Card title="查询结果">
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

      {statistics && tickets.length === 0 && (
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
