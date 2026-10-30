import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Form, InputNumber, Modal, Space, Tag,
  Popconfirm, message, Upload, Row, Col, Statistic, Tooltip, Select
} from 'antd';
import {
  UserAddOutlined, UploadOutlined, DownloadOutlined, DeleteOutlined,
  EditOutlined, SearchOutlined, ReloadOutlined, CrownOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { Crown, UserCheck, Trophy } from 'lucide-react';
import axios from 'axios';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` } });

export default function GuestsTab({ onGuestChange }) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState('replace');
  const [uploading, setUploading] = useState(false);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadGuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/guests', auth());
      setGuests(res.data);
      if (onGuestChange) onGuestChange(res.data);
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to load guest list');
    } finally {
      setLoading(false);
    }
  }, [onGuestChange]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  // Handle Manual Add
  const handleAddFinish = async (values) => {
    try {
      await axios.post('/api/guests/add', values, auth());
      message.success('Guest added successfully!');
      setIsAddModalOpen(false);
      addForm.resetFields();
      loadGuests();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to add guest');
    }
  };

  // Handle Edit
  const openEditModal = (guest) => {
    setEditingGuest(guest);
    editForm.setFieldsValue({
      serialNo: guest.serialNo,
      name: guest.name,
      unit: guest.unit,
    });
    setIsEditModalOpen(true);
  };

  const handleEditFinish = async (values) => {
    if (!editingGuest) return;
    try {
      await axios.put(`/api/guests/${editingGuest._id}`, values, auth());
      message.success('Guest updated successfully!');
      setIsEditModalOpen(false);
      setEditingGuest(null);
      loadGuests();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to update guest');
    }
  };

  // Handle Single Delete
  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/guests/${id}`, auth());
      message.success('Guest deleted');
      loadGuests();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  // Handle Batch Delete
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      await axios.post('/api/guests/batch-delete', { ids: selectedRowKeys }, auth());
      message.success(`Deleted ${selectedRowKeys.length} guest(s)`);
      setSelectedRowKeys([]);
      loadGuests();
    } catch (e) {
      message.error(e.response?.data?.message || 'Batch delete failed');
    }
  };

  // Handle Clear All
  const handleClearAll = async () => {
    try {
      await axios.delete('/api/guests/all', auth());
      message.success('All guests cleared');
      setSelectedRowKeys([]);
      loadGuests();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to clear guests');
    }
  };

  // Handle Upload
  const handleFileUpload = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', uploadMode);

    try {
      const res = await axios.post('/api/guests/upload', formData, {
        headers: {
          ...auth().headers,
          'Content-Type': 'multipart/form-data',
        },
      });
      message.success(res.data.message || 'File uploaded successfully!');
      setIsUploadModalOpen(false);
      loadGuests();
    } catch (e) {
      const errMsg = e.response?.data?.message || 'Upload failed';
      const details = e.response?.data?.errors ? `: ${e.response.data.errors.join(', ')}` : '';
      message.error(errMsg + details);
    } finally {
      setUploading(false);
    }
    return false; // prevent default antd upload
  };

  // Download Sample Template
  const downloadSampleTemplate = () => {
    const csvContent =
      "Serial No.,Name,Unit\n" +
      "1,Rajesh Sharma,PGTL Unit 1\n" +
      "2,Anita Verma,PGTL Corporate\n" +
      "3,Vikram Malhotra,PGTL Unit 2\n" +
      "4,Suresh Patel,PGTL Solar\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'guest_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Template downloaded! Headings: Serial No. , Name , Unit');
  };

  // Statistics
  const totalCount = guests.length;
  const eligibleCount = guests.filter(g => !g.won).length;
  const wonCount = guests.filter(g => g.won).length;

  // Filtered list
  const filteredGuests = guests.filter(g => {
    if (statusFilter === 'eligible' && g.won) return false;
    if (statusFilter === 'won' && !g.won) return false;
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.unit && g.unit.toLowerCase().includes(q)) ||
      String(g.serialNo).includes(q)
    );
  });

  const columns = [
    {
      title: 'Lucky / Serial No.',
      dataIndex: 'serialNo',
      width: 140,
      sorter: (a, b) => a.serialNo - b.serialNo,
      render: (sNo) => (
        <Tag
          style={{
            fontSize: 13,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #7B1FA2 0%, #4A154B 100%)',
            color: '#fff',
            border: '1px solid #D4AF37',
            padding: '2px 10px',
            borderRadius: 6,
          }}
        >
          #{sNo}
        </Tag>
      ),
    },
    {
      title: 'Guest Name',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name) => <b style={{ fontSize: 14, color: '#1a1a1a' }}>{name}</b>,
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      sorter: (a, b) => (a.unit || '').localeCompare(b.unit || ''),
      render: (unit) => (
        <span style={{ fontWeight: 600, color: '#4A154B' }}>{unit || '—'}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'won',
      width: 130,
      render: (won) =>
        won ? (
          <Tag color="gold" icon={<CrownOutlined />} style={{ fontWeight: 700 }}>
            Winner
          </Tag>
        ) : (
          <Tag color="green" style={{ fontWeight: 600 }}>
            Eligible
          </Tag>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#1677ff' }} />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete this guest?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto' }}>
      {/* Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: '14px 18px' }}>
            <Statistic
              title={<span style={{ fontSize: 13, fontWeight: 700 }}>Total Guests</span>}
              value={totalCount}
              valueStyle={{ color: '#7B1FA2', fontWeight: 800, fontSize: 24 }}
              prefix={<Crown size={18} style={{ color: '#7B1FA2', marginRight: 4 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bodyStyle={{ padding: '14px 18px' }}>
            <Statistic
              title={<span style={{ fontSize: 13, fontWeight: 700 }}>Eligible</span>}
              value={eligibleCount}
              valueStyle={{ color: '#52c41a', fontWeight: 800, fontSize: 24 }}
              prefix={<UserCheck size={18} style={{ color: '#52c41a', marginRight: 4 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bodyStyle={{ padding: '14px 18px' }}>
            <Statistic
              title={<span style={{ fontSize: 13, fontWeight: 700 }}>Won Draw</span>}
              value={wonCount}
              valueStyle={{ color: '#D4AF37', fontWeight: 800, fontSize: 24 }}
              prefix={<Trophy size={18} style={{ color: '#D4AF37', marginRight: 4 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Guest Management Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={20} style={{ color: '#7B1FA2' }} />
            <span style={{ fontWeight: 800, fontSize: 16 }}>VIP Guest List Management</span>
          </div>
        }
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => {
                const nextSerial = guests.length > 0 ? Math.max(...guests.map(g => g.serialNo || 0)) + 1 : 1;
                addForm.setFieldsValue({ serialNo: nextSerial, name: '', unit: '' });
                setIsAddModalOpen(true);
              }}
              style={{ background: '#7B1FA2', borderColor: '#7B1FA2', fontWeight: 700 }}
            >
              Add Guest
            </Button>

            <Button
              icon={<UploadOutlined />}
              onClick={() => setIsUploadModalOpen(true)}
              style={{ fontWeight: 600 }}
            >
              Upload Excel/CSV
            </Button>

            <Button
              icon={<DownloadOutlined />}
              onClick={downloadSampleTemplate}
              title="Download Excel template with headers: Serial No. , Name , Unit"
            >
              Template
            </Button>

            <Popconfirm
              title="Are you sure you want to delete ALL guests?"
              description="This will clear the entire guest list from the database."
              onConfirm={handleClearAll}
              okText="Clear All"
              okType="danger"
            >
              <Button danger icon={<DeleteOutlined />} disabled={totalCount === 0}>
                Clear All
              </Button>
            </Popconfirm>

            <Button icon={<ReloadOutlined />} onClick={loadGuests} />
          </Space>
        }
      >
        {/* Search, Filter & Bulk Actions */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle" justify="space-between">
          <Col xs={24} sm={10} md={8}>
            <Input
              placeholder="Search Name, Unit, or Serial No..."
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} sm={6} md={6}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'eligible', label: 'Eligible Only' },
                { value: 'won', label: 'Winners Only' },
              ]}
            />
          </Col>

          <Col xs={24} sm={8} md={10} style={{ textAlign: 'right' }}>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`Delete ${selectedRowKeys.length} selected guests?`}
                onConfirm={handleBatchDelete}
                okText="Delete"
                okType="danger"
              >
                <Button danger type="primary">
                  Delete Selected ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
          </Col>
        </Row>

        {/* Guest Table */}
        <Table
          rowKey="_id"
          dataSource={filteredGuests}
          columns={columns}
          loading={loading}
          scroll={{ x: 650 }}
          pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ['15', '25', '50', '100'] }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          locale={{ emptyText: 'No guests found. Click "Add Guest" or "Upload Excel/CSV" to add people.' }}
        />
      </Card>

      {/* MODAL 1: Add Guest Manually */}
      <Modal
        title="➕ Manually Add Guest"
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddFinish} style={{ marginTop: 16 }}>
          <Form.Item
            name="serialNo"
            label="Serial No. / Lucky Number"
            rules={[{ required: true, message: 'Please enter a serial number' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 1, 2, 3..." />
          </Form.Item>

          <Form.Item
            name="name"
            label="Guest Name"
            rules={[{ required: true, message: 'Please enter guest name' }]}
          >
            <Input placeholder="e.g. Rajesh Sharma" />
          </Form.Item>

          <Form.Item name="unit" label="Unit">
            <Input placeholder="e.g. PGTL Unit 1" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#7B1FA2', borderColor: '#7B1FA2' }}>
                Save Guest
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 2: Edit Guest */}
      <Modal
        title="✏️ Edit Guest Details"
        open={isEditModalOpen}
        onCancel={() => { setIsEditModalOpen(false); setEditingGuest(null); }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditFinish} style={{ marginTop: 16 }}>
          <Form.Item
            name="serialNo"
            label="Serial No. / Lucky Number"
            rules={[{ required: true, message: 'Please enter a serial number' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Guest Name"
            rules={[{ required: true, message: 'Please enter guest name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="unit" label="Unit">
            <Input />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setIsEditModalOpen(false); setEditingGuest(null); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#7B1FA2', borderColor: '#7B1FA2' }}>
                Update Guest
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 3: Upload Excel / CSV */}
      <Modal
        title="📂 Upload Guest Excel / CSV File"
        open={isUploadModalOpen}
        onCancel={() => setIsUploadModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Upload Mode:</div>
            <Select
              value={uploadMode}
              onChange={setUploadMode}
              style={{ width: '100%' }}
              options={[
                { value: 'replace', label: '🔄 Replace — Clears existing guests and replaces with file' },
                { value: 'append', label: '➕ Append — Adds records to existing guest list' },
              ]}
            />
          </div>

          <div style={{ background: '#faf5ff', padding: '12px 16px', borderRadius: 8, border: '1px dashed #7B1FA2', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#7B1FA2', fontSize: 13 }}>
              📋 Expected Column Headings:
            </div>
            <div style={{ color: '#333', fontSize: 12, marginTop: 4 }}>
              <b>Serial No.</b> &nbsp;|&nbsp; <b>Name</b> &nbsp;|&nbsp; <b>Unit</b>
            </div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
              (If Serial No. is missing, numbers 1, 2, 3... will be assigned automatically)
            </div>
          </div>

          <Upload.Dragger
            accept=".xlsx,.xls,.csv"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            disabled={uploading}
            style={{ padding: '20px 0' }}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ color: '#7B1FA2', fontSize: 44 }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>
              Click or drag guest Excel / CSV file here
            </p>
            <p className="ant-upload-hint" style={{ color: '#888' }}>
              Supports .xlsx, .xls, and .csv formats
            </p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  );
}
