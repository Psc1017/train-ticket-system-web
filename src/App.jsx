import React, { useState, useEffect } from 'react'
import { Layout, Typography, Tabs, Button, Space } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import SearchTicket from './components/SearchTicket'
import PurchaseRecords from './components/PurchaseRecords'
import DataManagement from './components/DataManagement'
import dbManager from './utils/indexedDB'
import SurveyModal from './components/SurveyModal'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  const [dbReady, setDbReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [surveyOpen, setSurveyOpen] = useState(false)

  useEffect(() => {
    initializeDB()
    // 若带有 ?survey=1 或 hash #survey，则自动打开问卷
    const p = new URLSearchParams(window.location.search)
    if (p.get('survey') === '1' || window.location.hash === '#survey') {
      setSurveyOpen(true)
    }
  }, [])

  const initializeDB = async () => {
    try {
      await dbManager.init()
      setDbReady(true)
      console.log('数据库初始化成功')
    } catch (error) {
      console.error('数据库初始化失败:', error)
      setDbReady(false)
    } finally {
      setLoading(false)
    }
  }

  const tabItems = [
    {
      key: '1',
      label: '票价查询',
      children: <SearchTicket dbReady={dbReady} />
    },
    {
      key: '2',
      label: '购票记录',
      children: <PurchaseRecords dbReady={dbReady} />
    },
    {
      key: '3',
      label: '数据管理',
      children: <DataManagement dbReady={dbReady} />
    }
  ]

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        正在初始化...
      </div>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#1890ff', 
        padding: '0 50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Space>
          <Button 
            type="primary"
            icon={<HomeOutlined />}
            onClick={() => window.location.href = '/'}
            style={{ 
              background: '#fff', 
              color: '#1890ff',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            返回首页
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>高铁票价查询系统</Title>
        </Space>
        <Button 
          type="text" 
          size="small" 
          onClick={() => setSurveyOpen(true)}
          style={{ color: 'white', fontSize: '12px' }}
        >
          问卷
        </Button>
      </Header>
      <Content style={{ padding: '50px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <Tabs
          defaultActiveKey="1"
          items={tabItems}
          size="large"
        />
      </Content>
      <SurveyModal open={surveyOpen} onClose={() => setSurveyOpen(false)} />
    </Layout>
  )
}

export default App

