import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Form, 
  Select, 
  DatePicker, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Input,
  message,
  Statistic,
  Row,
  Col,
  Tooltip,
  Switch,
  Divider
} from 'antd'
import { 
  SearchOutlined, 
  RocketOutlined, 
  DollarOutlined,
  CalendarOutlined,
  ShoppingCartOutlined,
  SettingOutlined
} from '@ant-design/icons'
import dbManager from '../utils/indexedDB'
import { applyDiscountToTickets, getDiscountInfo } from '../utils/discountRule'
import { 
  applyComplexDiscountToTickets, 
  getComplexDiscountInfo,
  PRICE_FLOAT_SCENARIOS,
  DATE_TYPES,
  TIME_PERIODS,
  TRAVEL_TIME_TYPES
} from '../utils/complexDiscountRule'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

function SearchTicket({ dbReady }) {
  const [form] = Form.useForm()
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [tickets, setTickets] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [advanceDays, setAdvanceDays] = useState(0)
  const [participantId, setParticipantId] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  const [idInputValue, setIdInputValue] = useState('')
  
  // 复杂折扣参数
  const [useComplexDiscount, setUseComplexDiscount] = useState(false)
  const [priceFloatScenario, setPriceFloatScenario] = useState(PRICE_FLOAT_SCENARIOS.FLOAT_10)
  const [travelTimeType, setTravelTimeType] = useState(TRAVEL_TIME_TYPES.K0)

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
  }, [dbReady])

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

  const handleSearch = async (values) => {
    setLoading(true)
    try {
      const fromStation = values.fromStation
      const toStation = values.toStation
      
      // 计算提前购票天数
      const travelDate = values.travelDate || dayjs()
      const daysDiff = travelDate.diff(dayjs(), 'day')
      setAdvanceDays(daysDiff)

      const results = await dbManager.searchTickets(
        fromStation, 
        toStation,
        { limit: 5000 }
      )

      // 应用折扣
      let discountedTickets
      if (useComplexDiscount) {
        discountedTickets = applyComplexDiscountToTickets(results, {
          priceFloatScenario,
          travelTimeType,
          departureDate: travelDate.format('YYYY-MM-DD'),
          advanceDays: daysDiff
        })
      } else {
        discountedTickets = applyDiscountToTickets(results, daysDiff)
      }
      
      setTickets(discountedTickets)

      message.success(`找到 ${discountedTickets.length} 条结果（共查询 ${results.length} 条数据）`)
    } catch (error) {
      message.error('查询失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdvanceDaysChange = (days) => {
    setAdvanceDays(days)
    if (tickets.length > 0) {
      if (useComplexDiscount) {
        const formValues = form.getFieldsValue()
        const discountedTickets = applyComplexDiscountToTickets(tickets, {
          priceFloatScenario,
          travelTimeType,
          departureDate: formValues.travelDate?.format('YYYY-MM-DD'),
          advanceDays: days
        })
        setTickets(discountedTickets)
        message.info(`已更新复杂折扣: ${getComplexDiscountInfo({ priceFloatScenario, travelTimeType })}`)
      } else {
        const discountedTickets = applyDiscountToTickets(tickets, days)
        setTickets(discountedTickets)
        message.info(`已更新折扣: ${getDiscountInfo(days)}`)
      }
    }
  }

  const handlePurchase = async (ticket) => {
    if (!participantId) {
      message.error('参与者信息未初始化')
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
        advanceDays: advanceDays,
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
      render: (text) => <Tag color="blue"><RocketOutlined /> {text}</Tag>
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
      render: (price, record) => (
        <Space>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#f5222d' }}>
            <DollarOutlined /> ¥{price.toFixed(2)}
          </span>
          {record.discountInfo && (
            <Tag color="green">{record.discountInfo}</Tag>
          )}
        </Space>
      )
    },
    {
      title: '席别',
      dataIndex: 'seatType',
      key: 'seatType',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: '折扣详情',
      key: 'discountDetails',
      render: (_, record) => {
        if (record.discountDetails?.autoDetected) {
          return (
            <div>
              <div>{record.discountInfo}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {record.discountDetails.autoDetected.dateType}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {record.discountDetails.autoDetected.timePeriod}
              </div>
            </div>
          )
        }
        return record.discountInfo || '无折扣'
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
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
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
            <Col xs={24} sm={12} md={8} lg={6}>
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
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item
                label="出行日期"
                name="travelDate"
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="选择出行日期"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
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
          
          <Divider />
          
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item label="折扣模式">
                <Switch
                  checked={useComplexDiscount}
                  onChange={setUseComplexDiscount}
                  checkedChildren="复杂折扣"
                  unCheckedChildren="简单折扣"
                />
              </Form.Item>
            </Col>
            
            {useComplexDiscount && (
              <>
                <Col span={6}>
                  <Form.Item label="票价浮动情景">
                    <Select
                      value={priceFloatScenario}
                      onChange={setPriceFloatScenario}
                    >
                      <Option value={PRICE_FLOAT_SCENARIOS.FLOAT_10}>10%浮动</Option>
                      <Option value={PRICE_FLOAT_SCENARIOS.FLOAT_20}>20%浮动</Option>
                      <Option value={PRICE_FLOAT_SCENARIOS.FLOAT_30}>30%浮动</Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col span={6}>
                  <Form.Item label="旅行时间类型">
                    <Select
                      value={travelTimeType}
                      onChange={setTravelTimeType}
                    >
                      <Option value={TRAVEL_TIME_TYPES.K0}>K=0</Option>
                      <Option value={TRAVEL_TIME_TYPES.K1}>K=1</Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col span={6}>
                  <Form.Item label="自动识别">
                    <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: '6px', color: '#1890ff' }}>
                      <div>📅 日期类型：自动判断</div>
                      <div>⏰ 发车时段：从票价数据提取</div>
                    </div>
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </Form>
      </Card>

      {tickets.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic 
                title="提前购票" 
                value={`${advanceDays} 天`}
                prefix={<CalendarOutlined />}
                suffix={useComplexDiscount ? 
                  getComplexDiscountInfo({ priceFloatScenario, travelTimeType }) : 
                  getDiscountInfo(advanceDays)
                }
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="最低票价" 
                value={Math.min(...tickets.map(t => t.price))}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col span={8}>
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
        <Card 
          title={
            <Space>
              <span>查询结果</span>
              <Tooltip title="调整提前购票天数以查看不同折扣">
                <Select 
                  value={advanceDays} 
                  onChange={handleAdvanceDaysChange}
                  style={{ width: 200 }}
                  placeholder="选择提前购票天数"
                >
                  <Option value={0}>当日购票</Option>
                  <Option value={1}>提前1天</Option>
                  <Option value={2}>提前2天</Option>
                  <Option value={3}>提前3天</Option>
                  <Option value={7}>提前7天</Option>
                  <Option value={14}>提前14天</Option>
                  <Option value={30}>提前30天</Option>
                  <Option value={60}>提前60天</Option>
                </Select>
              </Tooltip>
            </Space>
          }
        >
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

