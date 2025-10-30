import React, { useState, useEffect } from 'react'
import { Layout, Typography, Tabs, message } from 'antd'
import SearchTicket from './components/SearchTicket'
import PurchaseRecords from './components/PurchaseRecords'
import DataManagement from './components/DataManagement'
import dbManager from './utils/indexedDB'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  const [dbReady, setDbReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeDB()
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
        alignItems: 'center'
      }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          高铁票价查询系统
        </Title>
      </Header>
      <Content style={{ padding: '50px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <Tabs
          defaultActiveKey="1"
          items={tabItems}
          size="large"
        />
      </Content>
    </Layout>
  )
}

export default App

