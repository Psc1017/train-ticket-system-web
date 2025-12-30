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
  Col
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
  getDiscountDescription
} from '../utils/newDiscountRule'

const { Option } = Select

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

  const handleSearch = async (values) => {
    setLoading(true)
    try {
      const fromStation = values.fromStation
      const toStation = values.toStation
      const dateType = values.dateType || 'workday'
      const advanceDaysRange = values.advanceDaysSelect || '1-3'
      
      setCurrentDateType(dateType)
      setCurrentAdvanceDays(advanceDaysRange)

      const results = await dbManager.searchTickets(
        fromStation, 
        toStation,
        { limit: 5000 }
      )

      // 保存原始结果
      setRawTickets(results)

      // 应用新的折扣逻辑
      const discountedTickets = applyNewDiscountToTickets(results, dateType, advanceDaysRange)
      
      setTickets(discountedTickets)

      message.success(`找到 ${discountedTickets.length} 条结果`)
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
      const discountedTickets = applyNewDiscountToTickets(rawTickets, value, currentAdvanceDays)
      setTickets(discountedTickets)
    }
  }

  const handleAdvanceDaysSelectChange = (value) => {
    setCurrentAdvanceDays(value)
    form.setFieldValue('advanceDaysSelect', value)
    
    if (rawTickets.length > 0) {
      const discountedTickets = applyNewDiscountToTickets(rawTickets, currentDateType, value)
      setTickets(discountedTickets)
    }
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
      title: '原始票价',
      dataIndex: 'originalPrice',
      key: 'originalPrice',
      render: (price) => price ? `¥${price.toFixed(2)}` : '-'
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
      title: '席别',
      dataIndex: 'seatType',
      key: 'seatType',
      render: (text) => <Tag>{text}</Tag>
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
            <Col xs={24} sm={12} md={6}>
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
            <Col xs={24} sm={12} md={6}>
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
            <Col xs={24} sm={12} md={4}>
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
