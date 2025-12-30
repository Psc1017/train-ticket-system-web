import React, { useEffect } from 'react'
import { Modal, Form, Input, Radio, Divider, message } from 'antd'
import dbManager from '../utils/indexedDB'

function SurveyModal({ open, onClose }) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      const pid = localStorage.getItem('participantId') || ''
      form.setFieldsValue({ participantId: pid })
    }
  }, [open])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await dbManager.saveSurvey({
        ...values,
        participantId: values.participantId || localStorage.getItem('participantId') || ''
      })
      message.success('问卷已保存，感谢您的参与！')
      onClose?.()
      form.resetFields()
    } catch (e) {
      if (e?.errorFields) return
      message.error('保存失败: ' + e.message)
    }
  }

  // 第四部分量表题目
  const likertQuestions = [
    { key: 'q1', text: '1.对我来说，进行该方式出行能够满足我的出行需求' },
    { key: 'q2', text: '2.对我来说，选择该方式出行很方便' },
    { key: 'q3', text: '3.我周围的人推荐我选择该方式出行' },
    { key: 'q4', text: '4.我周围有较多的人愿意选择该方式出行' },
    { key: 'q5', text: '5.对我来说，选择该方式出行比其他出行方式更好' },
    { key: 'q6', text: '6.对我来说，该出行方式乘坐过程中人身安全以及财产安全有保障' },
    { key: 'q7', text: '7.对我来说，该出行方式的换乘、候车以及购票很方便' },
    { key: 'q8', text: '8.对我来说，该出行方式行驶稳定、座椅舒适' },
    { key: 'q9', text: '9.对我来说，选择该出行方式已经成为我的固有习惯' },
    { key: 'q10', text: '10.下次出行时，我会不假思索的选择该出行方式' },
    { key: 'q11', text: '11.我基本不会考虑选择该出行方式之外的其他方式出行' },
    { key: 'q12', text: '12.我愿意将该出行方式推荐给身边人' },
    { key: 'q13', text: '13.下次出行时，我会优先考虑选择该出行方式' },
  ]

  // 表格单元格样式
  const cellStyle = { border: '1px solid #ddd', padding: 8, textAlign: 'center' }
  const textCellStyle = { border: '1px solid #ddd', padding: 8, textAlign: 'left' }

  return (
    <Modal 
      open={open} 
      onOk={handleOk} 
      onCancel={onClose} 
      title="高铁客票浮动下旅客出行行为选择调查"
      okText="提交并继续"
      cancelText="取消"
      width={900}
      style={{ top: 20 }}
      bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
    >
      <div style={{ padding: '10px 0' }}>
        <p style={{ marginBottom: 10 }}><strong>尊敬的受访者：</strong></p>
        <p style={{ textIndent: '2em', lineHeight: 1.8, marginBottom: 20 }}>
          您好！我是大连交通大学的学生，感谢您在百忙之中阅读这份问卷，您所提供的宝贵信息将是本研究成功的关键，此问卷用于探究旅客出行选择行为，无对错之分，只需根据您的真实感受填写即可。本调查采取匿名形式，不涉及个人隐私，仅用于学术研究，绝不会泄露您的信息，请您放心填写，衷心感谢您的配合与支持！
        </p>
      </div>

      <Form form={form} layout="vertical">
        {/* 一、个人特征调查 */}
        <Divider orientation="left">一、个人特征调查</Divider>
        <p style={{ marginBottom: 15, color: '#666' }}>针对下列题项，请在符合您情况的选项下打"√"</p>

        <Form.Item label="1、您的性别" name="gender" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 男</Radio>
            <Radio value="2">2) 女</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="2、您的年龄" name="age" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 18岁以下</Radio>
            <Radio value="2">2) 18-25岁</Radio>
            <Radio value="3">3) 26-35岁</Radio>
            <Radio value="4">4) 36-45岁</Radio>
            <Radio value="5">5) 46-55岁</Radio>
            <Radio value="6">6) 56-65岁</Radio>
            <Radio value="7">7) 65岁及以上</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="3、您的职业" name="occupation" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 企业单位人员</Radio>
            <Radio value="2">2) 学生</Radio>
            <Radio value="3">3) 公务员/事业单位人员</Radio>
            <Radio value="4">4) 务工人员</Radio>
            <Radio value="5">5) 个体从业者</Radio>
            <Radio value="6">6) 退休人员</Radio>
            <Radio value="7">7) 其他</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="4、您的学历" name="education" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 初中/中职及以下</Radio>
            <Radio value="2">2) 高中/高职</Radio>
            <Radio value="3">3) 大学专科</Radio>
            <Radio value="4">4) 大学本科</Radio>
            <Radio value="5">5) 硕士及以上</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="5、您的月收入" name="income" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 3000元以下</Radio>
            <Radio value="2">2) 3000-5000元</Radio>
            <Radio value="3">3) 5000-7000元</Radio>
            <Radio value="4">4) 7000-9000元</Radio>
            <Radio value="5">5) 9000-11000元</Radio>
            <Radio value="6">6) 11000元以上</Radio>
          </Radio.Group>
        </Form.Item>

        {/* 二、出行特征调查 */}
        <Divider orientation="left">二、出行特征调查</Divider>
        <p style={{ marginBottom: 15, color: '#666' }}>
          该部分为出行特征调查,请您根据即将进行的出市区出行，针对您选取的出行方式（高铁/动车、普速列车、民航、公路出行），根据您的实际想法进行选择。
        </p>

        <Form.Item label="1、您本次出行的目的城市：" required>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="departure" noStyle rules={[{ required: true, message: '请输入出发城市' }]}>
              <Input placeholder="出发城市" style={{ width: 120, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }} />
            </Form.Item>
            <span>—</span>
            <Form.Item name="destination" noStyle rules={[{ required: true, message: '请输入目的城市' }]}>
              <Input placeholder="目的城市" style={{ width: 120, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }} />
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item label="2、您本次出行选择的出行方式是" name="travel_mode" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 高铁/动车</Radio>
            <Radio value="2">2) 普速列车</Radio>
            <Radio value="3">3) 航空</Radio>
            <Radio value="4">4) 公路运输</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="3、您本次出行的费用来源是" name="expense_source" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 公费</Radio>
            <Radio value="2">2) 自费</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="4、您本次出行的同行人数是" name="companions" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 1人</Radio>
            <Radio value="2">2) 2人</Radio>
            <Radio value="3">3) 3人</Radio>
            <Radio value="4">4) 4人及以上</Radio>
          </Radio.Group>
        </Form.Item>

        {/* 三、高铁客票浮动情况调查 */}
        <Divider orientation="left">三、高铁客票浮动情况调查</Divider>

        <Form.Item label="1、您知道目前高铁票价进行票价浮动嘛？" name="price_awareness" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 完全不了解</Radio>
            <Radio value="2">2) 稍微了解</Radio>
            <Radio value="3">3) 有点了解</Radio>
            <Radio value="4">4) 比较了解</Radio>
            <Radio value="5">5) 非常了解</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="2、当高铁票价浮动后，您会考虑改变您的出行方式嘛？" name="change_plan" rules={[{ required: true, message: '请选择' }]}>
          <Radio.Group>
            <Radio value="1">1) 会</Radio>
            <Radio value="2">2) 不会</Radio>
            <Radio value="3">3) 不确定</Radio>
          </Radio.Group>
        </Form.Item>

        {/* 四、出行意向调查 */}
        <Divider orientation="left">四、出行意向调查</Divider>
        <p style={{ marginBottom: 15, color: '#666' }}>
          该部分为意向调查,请您根据您之前出行的经历或者自身意向选择，描述您对此次选取的出行方式（高铁/动车、普速列车、民航、公路运输）的看法。针对下列题项，请在符合您情况的选项下打"√"
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ ...cellStyle, width: '40%', textAlign: 'left' }}>调查项目</th>
                <th style={{ ...cellStyle, width: '12%' }}>非常不同意</th>
                <th style={{ ...cellStyle, width: '12%' }}>不同意</th>
                <th style={{ ...cellStyle, width: '12%' }}>一般</th>
                <th style={{ ...cellStyle, width: '12%' }}>同意</th>
                <th style={{ ...cellStyle, width: '12%' }}>非常同意</th>
              </tr>
            </thead>
            <tbody>
              {likertQuestions.map((q) => (
                <tr key={q.key}>
                  <td style={textCellStyle}>{q.text}</td>
                  <td colSpan={5} style={{ border: '1px solid #ddd', padding: '8px 0' }}>
                    <Form.Item name={q.key} noStyle rules={[{ required: true, message: '请选择' }]}>
                      <Radio.Group style={{ width: '100%', display: 'flex' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}><Radio value="1"></Radio></div>
                        <div style={{ flex: 1, textAlign: 'center' }}><Radio value="2"></Radio></div>
                        <div style={{ flex: 1, textAlign: 'center' }}><Radio value="3"></Radio></div>
                        <div style={{ flex: 1, textAlign: 'center' }}><Radio value="4"></Radio></div>
                        <div style={{ flex: 1, textAlign: 'center' }}><Radio value="5"></Radio></div>
                      </Radio.Group>
                    </Form.Item>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 参与者编号（用于数据关联） */}
        <Form.Item label="参与者编号" name="participantId" style={{ marginTop: 20 }}>
          <Input placeholder="如：张三、P001" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default SurveyModal
