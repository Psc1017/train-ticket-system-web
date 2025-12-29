import React, { useState, useEffect } from 'react'
import { Card, Form, Select, DatePicker, Button, Space, Row, Col, Table, Tag, Statistic, message, Divider } from 'antd'
import { 
  RocketOutlined, 
  DollarOutlined,
  SearchOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import dbManager from '../utils/indexedDB'
import { applyComplexDiscountToTickets } from '../utils/complexDiscountRule'
import { ensureKMap } from '../utils/trainKMap'
import dayjs from 'dayjs'

const { Option } = Select

function PriceComparison({ dbReady }) {
  const [form] = Form.useForm()
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [comparisonData, setComparisonData] = useState({
    highSpeed: null,      // 高铁/动车（我们的系统）
    normalTrain: null,    // 普速列车
    airplane: null,      // 航空
    bus: null            // 公路运输
  })
  const [selectedMode, setSelectedMode] = useState(null)

  useEffect(() => {
    ensureKMap()
    loadStations()
  }, [dbReady])

  const loadStations = async () => {
    try {
      const data = await dbManager.getAllStations()
      setStations(data)
    } catch (error) {
      console.error('加载站点失败:', error)
    }
  }

  const handleSearch = async (values) => {
    if (!dbReady) {
      message.error('数据库未初始化')
      return
    }

    setLoading(true)
    try {
      const fromStation = values.fromStation
      const toStation = values.toStation
      const travelDate = values.travelDate || dayjs()
      const daysDiff = Math.abs(travelDate.diff(dayjs(), 'day'))
      
      // 查询高铁/动车（我们的系统，带折扣）
      const highSpeedTickets = await dbManager.searchTickets(
        fromStation,
        toStation,
        { limit: 100 }
      )

      // 应用复杂折扣
      const discountedTickets = applyComplexDiscountToTickets(highSpeedTickets, {
        departureDate: travelDate.format('YYYY-MM-DD'),
        advanceDays: daysDiff
      })

      const minPrice = discountedTickets.length > 0 
        ? Math.min(...discountedTickets.map(t => t.price))
        : null
      const avgPrice = discountedTickets.length > 0
        ? discountedTickets.reduce((sum, t) => sum + t.price, 0) / discountedTickets.length
        : null

      setComparisonData({
        highSpeed: {
          mode: '高铁/动车',
          minPrice,
          avgPrice,
          count: discountedTickets.length,
          tickets: discountedTickets.slice(0, 5) // 只显示前5条
        },
        normalTrain: {
          mode: '普速列车',
          note: '请访问12306.cn查询',
          url: 'https://www.12306.cn/index/',
          manual: true
        },
        airplane: {
          mode: '航空',
          note: '请访问携程/航司官网查询',
          url: 'https://flights.ctrip.com/online/channel/domestic',
          manual: true
        },
        bus: {
          mode: '公路运输',
          note: '请访问携程汽车票查询',
          url: 'https://mm.ctrip.com/webapp/bus',
          manual: true
        }
      })

      message.success('查询完成！请查看各方式价格并选择')
    } catch (error) {
      message.error('查询失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMode = (mode) => {
    setSelectedMode(mode)
    message.success(`您选择了：${mode}`)
    // 这里可以保存选择记录到数据库，用于后续分析
  }

  const columns = [
    {
      title: '出行方式',
      dataIndex: 'mode',
      key: 'mode',
      render: (mode) => {
        const colors = {
          '高铁/动车': 'green',
          '普速列车': 'blue',
          '航空': 'orange',
          '公路运输': 'purple'
        }
        return <Tag color={colors[mode] || 'default'} style={{ fontSize: '14px', padding: '4px 12px' }}>{mode}</Tag>
      }
    },
    {
      title: '最低价格',
      dataIndex: 'minPrice',
      key: 'minPrice',
      render: (price, record) => {
        if (record.manual) {
          return <span style={{ color: '#999' }}>需手动查询</span>
        }
        return price ? (
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f5222d' }}>
            ¥{price.toFixed(2)}
          </span>
        ) : '-'
      }
    },
    {
      title: '平均价格',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      render: (price, record) => {
        if (record.manual || !price) return '-'
        return `¥${price.toFixed(2)}`
      }
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      key: 'source',
      render: (_, record) => {
        if (record.manual) {
          return (
            <Space>
              <Button 
                type="link" 
                size="small"
                onClick={() => window.open(record.url, '_blank')}
              >
                查看价格
              </Button>
            </Space>
          )
        }
        return <Tag color="green">系统查询</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.manual) {
          return (
            <Button 
              type="default"
              onClick={() => {
                window.open(record.url, '_blank')
                handleSelectMode(record.mode)
              }}
            >
              查看并选择
            </Button>
          )
        }
        return (
          <Button 
            type="primary"
            onClick={() => handleSelectMode(record.mode)}
          >
            选择此方式
          </Button>
        )
      }
    }
  ]

  const dataSource = Object.values(comparisonData).filter(item => item !== null)

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSearch}
        >
          <Form.Item
            label="出发站"
            name="fromStation"
            rules={[{ required: true, message: '请选择出发站' }]}
            style={{ minWidth: 200 }}
          >
            <Select 
              placeholder="选择出发站"
              showSearch
              filterOption={(input, option) =>
                option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {/* 动态加载站点列表 */}
              {stations.map(station => (
                <Option key={station.name} value={station.name}>
                  {station.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="到达站"
            name="toStation"
            rules={[{ required: true, message: '请选择到达站' }]}
            style={{ minWidth: 200 }}
          >
              <Select 
              placeholder="选择到达站"
              showSearch
              filterOption={(input, option) =>
                option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {stations.map(station => (
                <Option key={station.name} value={station.name}>
                  {station.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="出行日期"
            name="travelDate"
          >
            <DatePicker style={{ width: 150 }} />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              icon={<SearchOutlined />}
              loading={loading}
              size="large"
            >
              查询所有方式价格
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {comparisonData.highSpeed && (
        <>
          <Card 
            title={
              <Space>
                <DollarOutlined />
                <span>四种出行方式价格对比</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Table
              columns={columns}
              dataSource={dataSource}
              rowKey="mode"
              pagination={false}
              loading={loading}
            />
          </Card>

          {comparisonData.highSpeed.tickets && comparisonData.highSpeed.tickets.length > 0 && (
            <Card title="高铁/动车详细票价（系统查询）" style={{ marginBottom: 24 }}>
              <Table
                columns={[
                  { title: '车次', dataIndex: 'trainNumber', key: 'trainNumber' },
                  { title: '出发站', dataIndex: 'fromStation', key: 'fromStation' },
                  { title: '到达站', dataIndex: 'toStation', key: 'toStation' },
                  { title: '发车时间', dataIndex: 'departureTime', key: 'departureTime' },
                  { 
                    title: '折后票价', 
                    dataIndex: 'price', 
                    key: 'price',
                    render: (price) => <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#f5222d' }}>¥{price.toFixed(2)}</span>
                  },
                  { 
                    title: '折扣信息', 
                    dataIndex: 'discountInfo', 
                    key: 'discountInfo',
                    render: (info) => <Tag color="green">{info}</Tag>
                  }
                ]}
                dataSource={comparisonData.highSpeed.tickets}
                rowKey={(record, index) => index}
                pagination={false}
                size="small"
              />
            </Card>
          )}

          {selectedMode && (
            <Card 
              title="您的选择" 
              style={{ 
                background: '#e6f7ff', 
                border: '2px solid #1890ff',
                marginBottom: 24
              }}
            >
              <Space size="large">
                <CheckOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  您选择了：{selectedMode}
                </span>
              </Space>
            </Card>
          )}
        </>
      )}

      {!comparisonData.highSpeed && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <RocketOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <p>请在上方填写出发站、到达站和出行日期，点击"查询所有方式价格"开始对比</p>
          </div>
        </Card>
      )}
    </div>
  )
}

export default PriceComparison

