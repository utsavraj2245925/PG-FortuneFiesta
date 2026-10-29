import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Menu, Button, Upload, Table, Tag, Form, Input, InputNumber,
  message, Popconfirm, Card, Statistic, Row, Col, Badge, Space, Alert, Modal, Select, Tooltip, Pagination,
  Radio, Progress, Divider
} from 'antd';
import {
  UploadOutlined, PlayCircleOutlined, StepForwardOutlined,
  TrophyOutlined, TeamOutlined, GiftOutlined, LogoutOutlined,
  ReloadOutlined, EyeOutlined, DeleteOutlined, EditOutlined,
  FileExcelOutlined, DownloadOutlined, SearchOutlined, CrownOutlined
} from '@ant-design/icons';
import {
  Gamepad2,
  IdCard,
  Gift,
  Trophy,
  Users,
  UserPlus,
  Crown,
  ExternalLink,
  LogOut,
  Sparkles,
  Tv,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { GuestCardFront, GuestCardBack } from '../components/GuestCardsViewer';
import GuestsTab from '../components/GuestsTab';
import {
  captureElementToCanvas,
  createA4PdfDocument,
  createExactCardPdf,
  triggerDownload
} from '../utils/cardDownloader';
import JSZip from 'jszip';

const { Header, Sider, Content } = Layout;
const LOGO = '/pg-logo.png';
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` } });

const GROUP_LABELS = { 1: 'Group A', 2: 'Group B', 3: 'Group C' };
const GROUP_COLORS = { 1: 'blue', 2: 'purple', 3: 'green' };

const ROUND_NAMES = {
  1: '1A',
  2: '1B',
  3: '1C',
  4: '2A',
  5: '2B',
  6: '2C',
  7: '3A',
  8: '3B',
  9: '3C',
};

function roundToGroup(r) {
  if (r <= 3) return 1;
  if (r <= 6) return 2;
  return 3;
}

function CardsTab() {
  const [cardType, setCardType] = React.useState('employee'); // 'employee' | 'guest'
  const [employees, setEmployees] = React.useState([]);
  const [guests, setGuests] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');
  const [selectedGroup, setSelectedGroup] = React.useState('all');
  const [sideView, setSideView] = React.useState('back'); // 'back' | 'front' | 'both'
  const [printMode, setPrintMode] = React.useState('back'); // 'back' | 'front' | 'both'
  const [previewEmp, setPreviewEmp] = React.useState(null);
  const [previewGuest, setPreviewGuest] = React.useState(null);
  const [empPage, setEmpPage] = React.useState(1);
  const [empPageSize, setEmpPageSize] = React.useState(20);
  const [guestPage, setGuestPage] = React.useState(1);
  const [guestPageSize, setGuestPageSize] = React.useState(20);

  // ── Download Cards Modal States & Engine ──
  const [downloadModalOpen, setDownloadModalOpen] = React.useState(false);
  const [downloadTargetType, setDownloadTargetType] = React.useState('employee'); // 'employee' | 'guest'
  const [downloadFormat, setDownloadFormat] = React.useState('pdf'); // 'pdf' | 'jpg' | 'png'
  const [downloadSide, setDownloadSide] = React.useState('back'); // 'back' | 'front' | 'both'
  const [downloadScope, setDownloadScope] = React.useState('page'); // 'page' | 'all' | 'single'
  const [downloadSingleId, setDownloadSingleId] = React.useState(null);
  const [downloadPdfLayout, setDownloadPdfLayout] = React.useState('a4_sheet'); // 'a4_sheet' | 'exact'
  const [downloadQuality, setDownloadQuality] = React.useState(3); // 3 = 300 DPI, 2 = 150 DPI
  const [downloading, setDownloading] = React.useState(false);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [downloadStatusText, setDownloadStatusText] = React.useState('');
  const [activeExportCard, setActiveExportCard] = React.useState(null);
  const exportStageRef = React.useRef(null);

  const openDownloadModal = (type, specificItem = null) => {
    setDownloadTargetType(type);
    if (specificItem) {
      setDownloadScope('single');
      setDownloadSingleId(specificItem._id);
    } else {
      setDownloadScope('page');
      setDownloadSingleId(null);
    }
    setDownloadModalOpen(true);
  };

  const token = localStorage.getItem('pg_admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  const loadData = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get('/api/employees', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/guests', { headers }).catch(() => ({ data: [] })),
    ])
      .then(([empRes, guestRes]) => {
        setEmployees(empRes.data);
        setGuests(guestRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const doPrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const totalEmployees = employees.length;
  const groupSize = Math.ceil(totalEmployees / 3);
  const totalGuests = guests.length;

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const matchesGroup = selectedGroup === 'all' || String(emp.group) === String(selectedGroup);
    if (!matchesGroup) return false;
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.payCode && emp.payCode.toLowerCase().includes(q)) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(q)) ||
      (emp.unit && emp.unit.toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q)) ||
      String(emp.serialNo).includes(q)
    );
  });

  // Filtered guests
  const filteredGuests = guests.filter(g => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.unit && g.unit.toLowerCase().includes(q)) ||
      String(g.serialNo).includes(q)
    );
  });

  // ── Execute High-Quality Card Download ──
  const executeDownload = async () => {
    const isEmp = downloadTargetType === 'employee';
    const list = isEmp ? filteredEmployees : filteredGuests;
    const pageItems = isEmp
      ? filteredEmployees.slice((empPage - 1) * empPageSize, empPage * empPageSize)
      : filteredGuests.slice((guestPage - 1) * guestPageSize, guestPage * guestPageSize);

    let itemsToProcess = [];
    if (downloadScope === 'single') {
      const found = list.find(x => x._id === downloadSingleId);
      if (!found) {
        message.warning('Please select a card to download');
        return;
      }
      itemsToProcess = [found];
    } else if (downloadScope === 'page') {
      itemsToProcess = pageItems;
    } else {
      itemsToProcess = list;
    }

    if (itemsToProcess.length === 0) {
      message.warning('No cards available to download');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadStatusText('Preparing export engine...');

    try {
      const capturedImages = [];
      const zip = (downloadFormat === 'jpg' || downloadFormat === 'png') && itemsToProcess.length > 1
        ? new JSZip()
        : null;

      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        const cardName = item.name || `Card_${i + 1}`;
        const cardCode = isEmp ? (item.payCode || item.employeeId || item.serialNo || i + 1) : (item.serialNo || i + 1);

        setDownloadStatusText(`Rendering card ${i + 1} of ${itemsToProcess.length}: ${cardName}`);
        setDownloadProgress(Math.round((i / itemsToProcess.length) * 100));

        // Mount to hidden staging element
        setActiveExportCard({ type: downloadTargetType, item });

        // Wait a frame for React & browser render
        await new Promise(r => setTimeout(r, 120));

        if (!exportStageRef.current) {
          throw new Error('Export container not ready');
        }

        const canvas = await captureElementToCanvas(exportStageRef.current, downloadQuality);
        const mimeType = downloadFormat === 'png' ? 'image/png' : 'image/jpeg';
        const qualityVal = downloadFormat === 'png' ? undefined : 0.98;
        const dataUrl = canvas.toDataURL(mimeType, qualityVal);

        capturedImages.push(dataUrl);

        if (zip) {
          const base64Data = dataUrl.split(',')[1];
          const ext = downloadFormat === 'png' ? 'png' : 'jpg';
          const fileSafeName = `${String(i + 1).padStart(3, '0')}_${String(cardCode).replace(/[^a-zA-Z0-9]/g, '')}_${String(cardName).replace(/[^a-zA-Z0-9]/g, '_')}_${downloadSide}.${ext}`;
          zip.file(fileSafeName, base64Data, { base64: true });
        }

        setDownloadProgress(Math.round(((i + 1) / itemsToProcess.length) * 100));
      }

      setDownloadStatusText('Packaging downloaded files...');

      const timeStamp = new Date().toISOString().slice(0, 10);
      const prefix = isEmp ? 'PG_Employee_Cards' : 'PG_VIP_Guest_Cards';
      const sideName = downloadSide === 'both' ? 'BothSides' : downloadSide === 'front' ? 'Side1_Front' : 'Side2_Back';

      if (downloadFormat === 'pdf') {
        const pdf = downloadPdfLayout === 'a4_sheet'
          ? createA4PdfDocument(capturedImages, downloadSide === 'both')
          : createExactCardPdf(capturedImages, downloadSide === 'both');

        pdf.save(`${prefix}_${sideName}_${timeStamp}.pdf`);
        message.success(`Successfully downloaded ${itemsToProcess.length} cards as PDF!`);
      } else if (itemsToProcess.length === 1) {
        const ext = downloadFormat === 'png' ? 'png' : 'jpg';
        const singleItem = itemsToProcess[0];
        const code = isEmp ? (singleItem.payCode || singleItem.employeeId || 'card') : (singleItem.serialNo || 'card');
        const filename = `${prefix}_${code}_${sideName}.${ext}`;
        triggerDownload(capturedImages[0], filename);
        message.success(`Successfully downloaded card as ${ext.toUpperCase()}!`);
      } else if (zip) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(zipBlob, `${prefix}_${sideName}_${itemsToProcess.length}_cards_${timeStamp}.zip`);
        message.success(`Successfully downloaded ZIP archive with ${itemsToProcess.length} ${downloadFormat.toUpperCase()} cards!`);
      }

      setDownloadModalOpen(false);
    } catch (err) {
      console.error('Download error:', err);
      message.error('Failed to export cards: ' + (err.message || 'Unknown error'));
    } finally {
      setActiveExportCard(null);
      setDownloading(false);
      setDownloadProgress(0);
      setDownloadStatusText('');
    }
  };

  return (
    <>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body > *:not(#cards-print-root) { display: none !important; }
          #cards-print-root {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            align-content: flex-start !important;
            gap: 2mm !important;
            width: 100% !important;
          }
          .no-print { display: none !important; }
          @page {
            size: A4 portrait;
            margin: 6mm 6mm;
          }
          .print-card-unit {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 1.5mm !important;
          }
        }
        #cards-print-root { display: none; }
      `}</style>

      {/* Admin UI — hidden during print */}
      <div className="no-print">
        {/* TOP TOGGLER BUTTON: EMPLOYEE VS GUEST CARDS */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'inline-flex', background: '#e5e7eb', padding: 4, borderRadius: 10, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
            <Button
              type={cardType === 'employee' ? 'primary' : 'text'}
              onClick={() => { setCardType('employee'); setSearchText(''); setEmpPage(1); }}
              icon={<Users size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
              style={
                cardType === 'employee'
                  ? { background: '#C8102E', borderColor: '#C8102E', fontWeight: 800, borderRadius: 8, height: 40, paddingInline: 20 }
                  : { fontWeight: 700, color: '#4b5563', height: 40 }
              }
            >
              Employee Cards ({totalEmployees})
            </Button>
            <Button
              type={cardType === 'guest' ? 'primary' : 'text'}
              onClick={() => { setCardType('guest'); setSearchText(''); setGuestPage(1); }}
              icon={<Crown size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
              style={
                cardType === 'guest'
                  ? { background: '#7B1FA2', borderColor: '#7B1FA2', fontWeight: 800, borderRadius: 8, height: 40, paddingInline: 20 }
                  : { fontWeight: 700, color: '#4b5563', height: 40 }
              }
            >
              VIP Guest Cards ({totalGuests})
            </Button>
          </div>

          <div style={{ fontSize: 13, color: '#666' }}>
            {cardType === 'guest'
              ? 'Displaying VIP Guest Cards (PG Utsav 2026 Front + #EBEDE3 Back with Royal Purple Border)'
              : 'Displaying Official Employee Visiting Cards (Rounds 1A–3C)'}
          </div>
        </div>

        {/* ── VIEW 1: EMPLOYEE CARDS ── */}
        {cardType === 'employee' && (
          <>
            <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IdCard size={22} style={{ color: '#C8102E' }} /> PG Fortune Fiesta — 2-Sided Employee Visiting Cards
            </h2>

            {/* Info & Config Card */}
            <Card style={{ marginBottom: 20 }}>
              <Row gutter={[16, 16]} align="middle" justify="space-between">
                <Col xs={24} md={12}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                    Total Cards: <span style={{ color: '#C8102E' }}>{totalEmployees} Employees</span>
                  </div>
                  {totalEmployees > 0 ? (
                    <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
                      <Tag color="blue">Group A: 1 – {groupSize}</Tag>
                      <Tag color="purple">Group B: {groupSize + 1} – {groupSize * 2}</Tag>
                      <Tag color="green">Group C: {groupSize * 2 + 1} – {totalEmployees}</Tag>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, color: '#888', fontSize: 13 }}>
                      ⚠️ No employees found. Please upload your employee Excel/CSV in the Employees tab.
                    </div>
                  )}
                </Col>

                <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                  <Space wrap>
                    <Button
                      size="large"
                      icon={<DownloadOutlined />}
                      onClick={() => openDownloadModal('employee')}
                      disabled={totalEmployees === 0}
                      style={{
                        background: '#10b981',
                        borderColor: '#10b981',
                        color: '#fff',
                        fontWeight: 800,
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      📥 Download Cards (PDF / JPG / PNG)
                    </Button>
                    <Button
                      size="large"
                      onClick={() => doPrint('back')}
                      disabled={totalEmployees === 0}
                      style={{ background: '#C8102E', borderColor: '#C8102E', color: '#fff', fontWeight: 700 }}
                    >
                      🖨️ Print Back Sides (QR & Details)
                    </Button>
                    <Button
                      size="large"
                      onClick={() => doPrint('front')}
                      disabled={totalEmployees === 0}
                      style={{ background: '#D4AF37', borderColor: '#D4AF37', color: '#000', fontWeight: 700 }}
                    >
                      🖨️ Print Front (Diwali Greetings)
                    </Button>
                    <Button
                      size="large"
                      onClick={() => doPrint('both')}
                      disabled={totalEmployees === 0}
                    >
                      🖨️ Print Both Sides
                    </Button>
                  </Space>
                </Col>
              </Row>

              {/* Controls: Search, Group filter, View side switcher */}
              <Row gutter={[12, 12]} style={{ marginTop: 20 }} align="middle">
                <Col xs={24} sm={10} md={8}>
                  <Input
                    placeholder="Search Name, Emp ID, Unit, Dept..."
                    prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                    value={searchText}
                    onChange={e => { setSearchText(e.target.value); setEmpPage(1); }}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={7} md={6}>
                  <Select
                    value={selectedGroup}
                    onChange={val => { setSelectedGroup(val); setEmpPage(1); }}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'all', label: 'All Groups' },
                      { value: '1', label: 'Group A only' },
                      { value: '2', label: 'Group B only' },
                      { value: '3', label: 'Group C only' },
                    ]}
                  />
                </Col>
                <Col xs={24} sm={7} md={10} style={{ textAlign: 'right' }}>
                  <Space align="center">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>Show View:</span>
                    <Select
                      value={sideView}
                      onChange={setSideView}
                      style={{ width: 220 }}
                      options={[
                        { value: 'back', label: 'Side 2 (Back: QR & Details)' },
                        { value: 'front', label: 'Side 1 (Front: Diwali Greeting)' },
                        { value: 'both', label: 'Both Sides (Side-by-side)' },
                      ]}
                    />
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* Cards Preview Grid with Pagination */}
            {totalEmployees > 0 && (
              <>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    Cards Preview — Showing page {empPage} of {Math.ceil(filteredEmployees.length / empPageSize) || 1} ({filteredEmployees.length} filtered cards)
                  </span>
                  <span style={{ color: '#888', fontSize: 13 }}>
                    (Click any card to preview full size • All {totalEmployees} cards will print)
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' }}>
                  {filteredEmployees.slice((empPage - 1) * empPageSize, empPage * empPageSize).map(emp => (
                    <div
                      key={emp._id}
                      onClick={() => setPreviewEmp(emp)}
                      style={{ cursor: 'pointer', transition: 'transform 0.2s', display: 'inline-flex' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Click to view full preview"
                    >
                      {sideView === 'front' && <CardFront emp={emp} />}
                      {sideView === 'back' && <CardBack emp={emp} />}
                      {sideView === 'both' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <CardFront emp={emp} />
                          <CardBack emp={emp} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination matching reference */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Pagination
                    current={empPage}
                    pageSize={empPageSize}
                    total={filteredEmployees.length}
                    onChange={(page, pageSize) => {
                      setEmpPage(page);
                      setEmpPageSize(pageSize);
                    }}
                    showSizeChanger
                    pageSizeOptions={['12', '20', '40', '80', '100']}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* ── VIEW 2: VIP GUEST CARDS (ROYAL PURPLE THEME) ── */}
        {cardType === 'guest' && (
          <>
            <h2 style={{ marginBottom: 16, color: '#4A154B', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crown size={22} style={{ color: '#7B1FA2' }} /> PG Fortune Fiesta — Premium VIP Guest Cards (Royal Purple Theme)
            </h2>

            {/* Info & Config Card for Guests */}
            <Card style={{ marginBottom: 20, borderTop: '4px solid #7B1FA2' }}>
              <Row gutter={[16, 16]} align="middle" justify="space-between">
                <Col xs={24} md={12}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                    Total VIP Guest Cards: <span style={{ color: '#7B1FA2' }}>{totalGuests} Guests</span>
                  </div>
                  <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
                    ✨ Front side displays official <b>PG Utsav 2026</b> festive art. Back side features a luxury <b>Royal Purple</b> theme with <b>VIP PASS</b>, Name, Unit, QR Code and celebration crackers design.
                  </div>
                </Col>

                <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                  <Space wrap>
                    <Button
                      size="large"
                      icon={<DownloadOutlined />}
                      onClick={() => openDownloadModal('guest')}
                      disabled={totalGuests === 0}
                      style={{
                        background: '#10b981',
                        borderColor: '#10b981',
                        color: '#fff',
                        fontWeight: 800,
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      📥 Download VIP Cards (PDF / JPG / PNG)
                    </Button>
                    <Button
                      size="large"
                      onClick={() => doPrint('back')}
                      disabled={totalGuests === 0}
                      style={{ background: '#7B1FA2', borderColor: '#7B1FA2', color: '#fff', fontWeight: 700 }}
                    >
                      🖨️ Print Back Sides (Purple VIP PASS & QR)
                    </Button>
                    <Button
                      size="large"
                      onClick={() => doPrint('front')}
                      disabled={totalGuests === 0}
                      style={{ background: '#D4AF37', borderColor: '#D4AF37', color: '#1a0026', fontWeight: 800 }}
                    >
                      🖨️ Print Front (PG UTSAV Greetings)
                    </Button>
                    <Button
                      size="large"
                      onClick={() => doPrint('both')}
                      disabled={totalGuests === 0}
                    >
                      🖨️ Print Both Sides
                    </Button>
                  </Space>
                </Col>
              </Row>

              {/* Controls: Search, View switcher */}
              <Row gutter={[12, 12]} style={{ marginTop: 20 }} align="middle">
                <Col xs={24} sm={12} md={10}>
                  <Input
                    placeholder="Search Guest Name, Unit, or Serial No..."
                    prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                    value={searchText}
                    onChange={e => { setSearchText(e.target.value); setGuestPage(1); }}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={14} style={{ textAlign: 'right' }}>
                  <Space align="center">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>Show View:</span>
                    <Select
                      value={sideView}
                      onChange={setSideView}
                      style={{ width: 240 }}
                      options={[
                        { value: 'back', label: 'Side 2 (Back: VIP PASS, Details & QR)' },
                        { value: 'front', label: 'Side 1 (Front: PG UTSAV Greeting)' },
                        { value: 'both', label: 'Both Sides (Side-by-side)' },
                      ]}
                    />
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* Guest Cards Preview Grid with Pagination */}
            {totalGuests > 0 ? (
              <>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>
                    VIP Guest Cards Preview — Showing page {guestPage} of {Math.ceil(filteredGuests.length / guestPageSize) || 1} ({filteredGuests.length} filtered cards)
                  </span>
                  <span style={{ color: '#888', fontSize: 13 }}>
                    (Click any card to preview full size • All {totalGuests} cards will print)
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' }}>
                  {filteredGuests.slice((guestPage - 1) * guestPageSize, guestPage * guestPageSize).map(g => (
                    <div
                      key={g._id}
                      onClick={() => setPreviewGuest(g)}
                      style={{ cursor: 'pointer', transition: 'transform 0.2s', display: 'inline-flex' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Click to view full preview"
                    >
                      {sideView === 'front' && <GuestCardFront guest={g} />}
                      {sideView === 'back' && <GuestCardBack guest={g} />}
                      {sideView === 'both' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <GuestCardFront guest={g} />
                          <GuestCardBack guest={g} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* VIP Guest Pagination matching reference */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Pagination
                    current={guestPage}
                    pageSize={guestPageSize}
                    total={filteredGuests.length}
                    onChange={(page, pageSize) => {
                      setGuestPage(page);
                      setGuestPageSize(pageSize);
                    }}
                    showSizeChanger
                    pageSizeOptions={['12', '20', '40', '80', '100']}
                  />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', background: '#fff', borderRadius: 12, border: '1px solid #eee' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👑</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>No VIP Guests Added Yet</div>
                <div style={{ color: '#888', marginTop: 4, fontSize: 13 }}>
                  Navigate to the <b>Guests</b> tab on the left sidebar to add guests or upload your Excel/CSV sheet.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── PRINT ROOT (ALL CARDS ON A4 SHEETS) ── */}
      <div id="cards-print-root">
        {cardType === 'employee' && employees.map(emp => (
          <React.Fragment key={emp._id}>
            {printMode === 'back' && (
              <div className="print-card-unit">
                <CardBack emp={emp} print />
              </div>
            )}
            {printMode === 'front' && (
              <div className="print-card-unit">
                <CardFront emp={emp} print />
              </div>
            )}
            {printMode === 'both' && (
              <div className="print-card-unit" style={{ display: 'inline-flex', gap: '2mm' }}>
                <CardFront emp={emp} print />
                <CardBack emp={emp} print />
              </div>
            )}
          </React.Fragment>
        ))}

        {cardType === 'guest' && guests.map(g => (
          <React.Fragment key={g._id}>
            {printMode === 'back' && (
              <div className="print-card-unit">
                <GuestCardBack guest={g} print />
              </div>
            )}
            {printMode === 'front' && (
              <div className="print-card-unit">
                <GuestCardFront guest={g} print />
              </div>
            )}
            {printMode === 'both' && (
              <div className="print-card-unit" style={{ display: 'inline-flex', gap: '2mm' }}>
                <GuestCardFront guest={g} print />
                <GuestCardBack guest={g} print />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Modal Preview for Employee */}
      <Modal
        open={previewEmp !== null}
        onCancel={() => setPreviewEmp(null)}
        footer={null}
        centered
        width={720}
        title={`Employee Card Preview — ${previewEmp?.name || ''} (#${previewEmp?.payCode || previewEmp?.employeeId || ''})`}
      >
        {previewEmp && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#888', marginBottom: 6 }}>
                  Side 1: Diwali Greetings
                </div>
                <CardFront emp={previewEmp} />
              </div>
              <div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#C8102E', marginBottom: 6 }}>
                  Side 2: PG Fortune Fiesta Card
                </div>
                <CardBack emp={previewEmp} />
              </div>
            </div>

            <div style={{ textAlign: 'center', color: '#666', fontSize: 13, maxWidth: 500, background: '#f9f9f9', padding: '10px 18px', borderRadius: 10, border: '1px solid #eee' }}>
              📱 <b>Scan Test:</b> Point your phone's camera at the QR code above.<br />
              It contains: <b>EMPLOYEE NAME: {previewEmp.name}</b> | <b>EMPLOYEE CODE: {previewEmp.payCode || previewEmp.employeeId}</b> | <b>CURRENT UNIT: {previewEmp.unit || 'PGTL'}</b>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => openDownloadModal('employee', previewEmp)}
              style={{
                background: '#10b981',
                borderColor: '#10b981',
                fontWeight: 700,
                borderRadius: 8,
              }}
            >
              📥 Download This Card (PDF / JPG / PNG)
            </Button>
          </div>
        )}
      </Modal>

      {/* Modal Preview for VIP Guest */}
      <Modal
        open={previewGuest !== null}
        onCancel={() => setPreviewGuest(null)}
        footer={null}
        centered
        width={720}
        title={`VIP Guest Card Preview — ${previewGuest?.name || ''} (#${previewGuest?.serialNo || ''})`}
      >
        {previewGuest && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#7B1FA2', marginBottom: 6 }}>
                  Side 1: PG UTSAV 2026 Festive Greeting Card
                </div>
                <GuestCardFront guest={previewGuest} />
              </div>
              <div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#4A154B', marginBottom: 6 }}>
                  Side 2: VIP Guest Pass (Back: #EBEDE3 with Purple Border)
                </div>
                <GuestCardBack guest={previewGuest} />
              </div>
            </div>

            <div style={{ textAlign: 'center', color: '#4A154B', fontSize: 13, maxWidth: 520, background: '#faf5ff', padding: '12px 20px', borderRadius: 10, border: '1px solid #ebd9f7' }}>
              📱 <b>VIP Guest Scan Test:</b> Point your phone's camera at the QR code.<br />
              Scans as:<br />
              <b>GUEST NAME: {previewGuest.name}</b><br />
              <b>UNIT: {previewGuest.unit || 'PGTL'}</b><br />
              <b>LUCKY NUMBER: #{previewGuest.serialNo}</b>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => openDownloadModal('guest', previewGuest)}
              style={{
                background: '#10b981',
                borderColor: '#10b981',
                fontWeight: 700,
                borderRadius: 8,
              }}
            >
              📥 Download This VIP Card (PDF / JPG / PNG)
            </Button>
          </div>
        )}
      </Modal>

      {/* ── HIDDEN HIGH-RES STAGING CONTAINER FOR CARD EXPORT ── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: -9999,
          opacity: 1,
          pointerEvents: 'none',
          visibility: 'visible',
        }}
      >
        <div
          ref={exportStageRef}
          style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: 0,
            padding: 0,
            margin: 0,
            background: '#ffffff',
          }}
        >
          {activeExportCard && (
            <>
              {(downloadSide === 'front' || downloadSide === 'both') && (
                activeExportCard.type === 'employee' ? (
                  <CardFront emp={activeExportCard.item} isHighRes forDownload />
                ) : (
                  <GuestCardFront guest={activeExportCard.item} isHighRes forDownload />
                )
              )}
              {(downloadSide === 'back' || downloadSide === 'both') && (
                activeExportCard.type === 'employee' ? (
                  <CardBack emp={activeExportCard.item} isHighRes forDownload />
                ) : (
                  <GuestCardBack guest={activeExportCard.item} isHighRes forDownload />
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* ── HIGH QUALITY DOWNLOAD MODAL (PDF / JPG / PNG) ── */}
      <Modal
        open={downloadModalOpen}
        onCancel={() => !downloading && setDownloadModalOpen(false)}
        footer={null}
        centered
        width={580}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>📥</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                Download {downloadTargetType === 'employee' ? 'Employee Visiting Cards' : 'VIP Guest Cards'}
              </div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
                Export high-resolution printable files in PDF, JPG, or PNG formats
              </div>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
          {/* 1. Format selection */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
              1. Choose File Format:
            </div>
            <Radio.Group
              value={downloadFormat}
              onChange={e => setDownloadFormat(e.target.value)}
              disabled={downloading}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
            >
              <Radio.Button
                value="pdf"
                style={{
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                <span>📄 PDF Document</span>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>Print Ready A4</span>
              </Radio.Button>
              <Radio.Button
                value="jpg"
                style={{
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                <span>🖼️ JPEG Image</span>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>High Quality 300 DPI</span>
              </Radio.Button>
              <Radio.Button
                value="png"
                style={{
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                <span>🎨 PNG Image</span>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>Lossless Graphic</span>
              </Radio.Button>
            </Radio.Group>
          </div>

          {/* 2. Side selection — Exactly matching reference image media_1793164165800_1e13a30c.png */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
              2. Choose Card Side to Export:
            </div>
            <Select
              value={downloadSide}
              onChange={setDownloadSide}
              disabled={downloading}
              style={{ width: '100%', height: 42 }}
              options={[
                { value: 'back', label: 'Side 2 (Back: QR & Details)' },
                { value: 'front', label: downloadTargetType === 'employee' ? 'Side 1 (Front: Diwali Greeting)' : 'Side 1 (Front: PG UTSAV 2026 Greeting)' },
                { value: 'both', label: 'Both Sides (Side-by-side)' },
              ]}
            />
          </div>

          {/* 3. Cards to include */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
              3. Which Cards to Download:
            </div>
            <Radio.Group
              value={downloadScope}
              onChange={e => setDownloadScope(e.target.value)}
              disabled={downloading}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="page">
                <b>Current Page</b> ({downloadTargetType === 'employee' ? Math.min(empPageSize, filteredEmployees.length) : Math.min(guestPageSize, filteredGuests.length)} cards)
              </Radio>
              <Radio value="single">
                <b>Single Card Only</b>
              </Radio>
              {downloadScope === 'single' && (
                <div style={{ marginLeft: 24, marginTop: 4 }}>
                  <Select
                    showSearch
                    placeholder={downloadTargetType === 'employee' ? 'Select Employee Card...' : 'Select VIP Guest Card...'}
                    value={downloadSingleId}
                    onChange={setDownloadSingleId}
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={(downloadTargetType === 'employee' ? filteredEmployees : filteredGuests).map(x => ({
                      value: x._id,
                      label: `${x.name} (#${downloadTargetType === 'employee' ? (x.payCode || x.employeeId || x.serialNo) : x.serialNo} • ${x.unit || 'PGTL'})`,
                    }))}
                  />
                </div>
              )}
              <Radio value="all">
                <b>All Filtered Cards</b> ({downloadTargetType === 'employee' ? filteredEmployees.length : filteredGuests.length} cards total)
              </Radio>
            </Radio.Group>
          </div>

          {/* 4. PDF Layout options if PDF selected */}
          {downloadFormat === 'pdf' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
                4. PDF Page Layout:
              </div>
              <Radio.Group
                value={downloadPdfLayout}
                onChange={e => setDownloadPdfLayout(e.target.value)}
                disabled={downloading}
              >
                <Radio value="a4_sheet">
                  <b>A4 Printable Sheets</b> (8 cards per sheet with cutting lines — Standard print shop layout)
                </Radio>
                <Radio value="exact">
                  <b>Individual Card Pages</b> (Exact card dimension 85.6mm × 54mm)
                </Radio>
              </Radio.Group>
            </div>
          )}

          {/* Quality option */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
              Resolution Quality:
            </div>
            <Radio.Group
              value={downloadQuality}
              onChange={e => setDownloadQuality(e.target.value)}
              disabled={downloading}
            >
              <Radio value={3}><b>Ultra HD (300 DPI)</b> — Crystal sharp for printing</Radio>
              <Radio value={2}><b>Standard HD (150 DPI)</b> — Faster download</Radio>
            </Radio.Group>
          </div>

          {/* Progress bar during export */}
          {downloading && (
            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                <span>{downloadStatusText}</span>
                <span style={{ color: '#10b981' }}>{downloadProgress}%</span>
              </div>
              <Progress percent={downloadProgress} showInfo={false} status="active" strokeColor="#10b981" />
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                Please keep this window open while high-resolution cards are rendered.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <Button onClick={() => setDownloadModalOpen(false)} disabled={downloading}>
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              loading={downloading}
              onClick={executeDownload}
              style={{
                background: '#10b981',
                borderColor: '#10b981',
                fontWeight: 800,
                paddingInline: 28,
              }}
            >
              {downloading ? 'Rendering & Downloading...' : '📥 Start Download'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Side 1: Diwali Greeting Card (High Resolution Image)
function CardFront({ emp, isHighRes = false, forDownload = false, print = false }) {
  const scale = isHighRes ? 2 : 1;
  const cardStyle = {
    width: 320 * scale,
    height: 202 * scale,
    boxSizing: 'border-box',
    borderRadius: 12 * scale,
    overflow: 'hidden',
    border: `${2 * scale}px solid #D4AF37`,
    display: 'inline-flex',
    boxShadow: (forDownload || print) ? 'none' : '0 6px 20px rgba(212,175,55,0.3)',
    position: 'relative',
    background: '#000',
    verticalAlign: 'top',
  };

  return (
    <div style={cardStyle}>
      <img
        src="/card_greeting_front.png"
        alt="Diwali Greetings"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

// Side 2: PG Fortune Fiesta Card (Header + QR Code + Employee Details)
function CardBack({ emp, isHighRes = false, forDownload = false, print = false }) {
  const GROUP_TEXT_COLORS = { 1: '#1d4ed8', 2: '#7c3aed', 3: '#15803d' };
  const grpText = emp.group === 1 ? 'Group A' : emp.group === 2 ? 'Group B' : 'Group C';

  const qrText =
`EMPLOYEE NAME: ${emp.name || ''}
EMPLOYEE CODE: ${emp.payCode || emp.employeeId || ''}
CURRENT UNIT: ${emp.unit || 'PGTL'}`;

  const scale = isHighRes ? 2 : 1;

  const cardStyle = {
    width: 320 * scale,
    height: 202 * scale,
    boxSizing: 'border-box',
    padding: `${10 * scale}px ${14 * scale}px`,
    border: `${2 * scale}px solid #D4AF37`,
    borderRadius: 12 * scale,
    background: '#F5F5DC',
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: (forDownload || print) ? 'none' : '0 6px 20px rgba(212,175,55,0.25)',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    verticalAlign: 'top',
  };

  return (
    <div style={cardStyle}>
      {/* Top Header */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `${1 * scale}px solid #e0d5be`, paddingBottom: 4 * scale }}>
        <img
          src={LOGO}
          alt="PG"
          style={{ height: 24 * scale, objectFit: 'contain' }}
        />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11 * scale, fontWeight: 900, color: '#C8102E', letterSpacing: 0.5 * scale, lineHeight: 1.15 }}>
            PG FORTUNE FIESTA CARD
          </div>
          <div style={{ fontSize: 8 * scale, color: '#475569', fontWeight: 700, marginTop: 1 * scale }}>
            💥 The Lucky Legends 2026 💥
          </div>
        </div>
        <span style={{ fontSize: 18 * scale, lineHeight: 1 }}>🪔</span>
      </div>

      {/* Middle Content: QR Code (Left) + Employee Details (Right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale, margin: `${4 * scale}px 0`, width: '100%', flex: 1 }}>
        {/* QR Code Container */}
        <div
          style={{
            flexShrink: 0,
            background: '#fff',
            padding: 5 * scale,
            borderRadius: 6 * scale,
            border: `${1.5 * scale}px solid #D4AF37`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QRCodeSVG value={qrText} size={68 * scale} level="M" includeMargin={false} />
        </div>

        {/* Employee Details List - High Contrast & No Overflow Clipping */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 * scale, textAlign: 'left', justifyContent: 'center' }}>
          {/* Name */}
          <div style={{ fontSize: 11 * scale, fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>
            <span style={{ color: '#334155', fontWeight: 800 }}>NAME: </span>
            <span>{emp.name || '—'}</span>
          </div>

          {/* Emp ID / Code */}
          <div style={{ fontSize: 10.5 * scale, fontWeight: 900, color: '#C8102E', lineHeight: 1.3 }}>
            <span style={{ color: '#334155', fontWeight: 800 }}>EMP ID: </span>
            <span>{emp.payCode || emp.employeeId || '—'}</span>
          </div>

          {/* Current Unit */}
          <div style={{ fontSize: 10 * scale, color: '#0f172a', fontWeight: 800, lineHeight: 1.3 }}>
            <span style={{ color: '#334155', fontWeight: 800 }}>UNIT: </span>
            <span>{emp.unit || 'PGTL'}</span>
          </div>

          {/* Department */}
          <div style={{ fontSize: 10 * scale, color: '#0f172a', fontWeight: 800, lineHeight: 1.3 }}>
            <span style={{ color: '#334155', fontWeight: 800 }}>DEPT: </span>
            <span>{emp.department || '—'}</span>
          </div>

          {/* Group - Clean bold colored text without background pill */}
          <div style={{ marginTop: 2 * scale }}>
            <span
              style={{
                fontSize: 10.5 * scale,
                fontWeight: 900,
                color: GROUP_TEXT_COLORS[emp.group] || '#1d4ed8',
                letterSpacing: 0.6 * scale,
                lineHeight: 1.2,
                display: 'inline-block',
              }}
            >
              {grpText}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div style={{ width: '100%', textAlign: 'center', borderTop: `${1 * scale}px solid #e0d5be`, paddingTop: 3 * scale }}>
        <div style={{ fontSize: 7.5 * scale, color: '#475569', fontWeight: 700, letterSpacing: 0.3 * scale }}>
          🪔 PG Group • Grand Diwali Fortune Fiesta 2026 🪔
        </div>
      </div>
    </div>
  );
}

// ── PrizesTab component ─────────────────────────────────────────────
function PrizesTab() {
  const [prizes, setPrizes] = React.useState(
    Array.from({ length: 10 }, (_, i) => ({
      roundNo: i + 1,
      name: '',
      description: '',
      imageUrl: '',
    }))
  );
  const [saving, setSaving] = React.useState({});
  const [saved, setSaved]   = React.useState({});

  React.useEffect(() => {
    axios.get('/api/prizes', { headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` } })
      .then(r => {
        setPrizes(prev => prev.map(p => {
          const found = r.data.find(x => x.roundNo === p.roundNo);
          return found ? { ...p, ...found } : p;
        }));
      });
  }, []);

  const update = (roundNo, field, value) => {
    setPrizes(prev => prev.map(p => p.roundNo === roundNo ? { ...p, [field]: value } : p));
    setSaved(prev => ({ ...prev, [roundNo]: false }));
  };

  const saveOne = async (roundNo) => {
    const prize = prizes.find(p => p.roundNo === roundNo);
    if (!prize.name.trim()) { message.warning('Prize name is required'); return; }
    setSaving(prev => ({ ...prev, [roundNo]: true }));
    try {
      await axios.post(`/api/prizes`, prize, {
        headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` },
      });
      setSaved(prev => ({ ...prev, [roundNo]: true }));
      message.success(roundNo === 10 ? 'VIP Guest Prize saved!' : `Round ${roundNo} saved`);
    } catch (e) {
      message.error(e.response?.data?.message || 'Save failed');
    }
    setSaving(prev => ({ ...prev, [roundNo]: false }));
  };

  const saveAll = async () => {
    const filled = prizes.filter(p => p.name.trim());
    if (!filled.length) { message.warning('Fill at least one prize'); return; }
    setSaving({ all: true });
    try {
      await axios.post('/api/prizes/batch', { prizes: filled }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` },
      });
      const allSaved = {};
      filled.forEach(p => { allSaved[p.roundNo] = true; });
      setSaved(allSaved);
      message.success('All prizes saved!');
    } catch (e) {
      message.error(e.response?.data?.message || 'Batch save failed');
    }
    setSaving({});
  };

  const groupLabel = (r) => r <= 3 ? { label: 'Group A', color: 'blue' }
                              : r <= 6 ? { label: 'Group B', color: 'purple' }
                              :          { label: 'Group C', color: 'orange' };

  const employeePrizes = prizes.slice(0, 9);
  const guestPrize = prizes[9] || { roundNo: 10, name: '', description: '', imageUrl: '' };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gift size={22} style={{ color: '#E65100' }} /> Prize Configuration — 9 Employee Rounds + Guest Prize
        </h2>
        <Button type="primary" size="large" loading={saving.all} onClick={saveAll}
          style={{ background: '#C8102E', borderColor: '#C8102E', fontWeight: 700 }}>
          Save All Prizes
        </Button>
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, color: '#C8102E', marginBottom: 12 }}>
        Employee Rounds (1A to 3C):
      </div>

      {employeePrizes.map(p => {
        const g = groupLabel(p.roundNo);
        return (
          <Card key={p.roundNo} style={{ marginBottom: 16, borderLeft: `4px solid ${g.color === 'blue' ? '#1677ff' : g.color === 'purple' ? '#722ed1' : '#fa8c16'}` }}
            bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 10 }}>
              <Tag color={g.color}>{g.label}</Tag>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Round {ROUND_NAMES[p.roundNo] || p.roundNo}</span>
              {saved[p.roundNo] && <Tag color="success">✓ Saved</Tag>}
            </div>
            <Row gutter={[12, 8]} align="middle">
              <Col xs={24} sm={7}>
                <Input
                  placeholder="Prize Name (e.g. CAR, BIKE)"
                  value={p.name}
                  onChange={e => update(p.roundNo, 'name', e.target.value)}
                  prefix={<span style={{ color: '#D4AF37' }}>🏆</span>}
                />
              </Col>
              <Col xs={24} sm={7}>
                <Input
                  placeholder="Description (e.g. Lucky Draw Diamond)"
                  value={p.description}
                  onChange={e => update(p.roundNo, 'description', e.target.value)}
                />
              </Col>
              <Col xs={24} sm={7}>
                <Input
                  placeholder="Image URL (optional)"
                  value={p.imageUrl}
                  onChange={e => update(p.roundNo, 'imageUrl', e.target.value)}
                  prefix="🖼"
                />
              </Col>
              <Col xs={24} sm={3}>
                <Button block type={saved[p.roundNo] ? 'default' : 'primary'}
                  loading={saving[p.roundNo]}
                  onClick={() => saveOne(p.roundNo)}
                  style={saved[p.roundNo] ? { borderColor: '#52c41a', color: '#52c41a' }
                                          : { background: '#C8102E', borderColor: '#C8102E' }}>
                  {saved[p.roundNo] ? '✓ Saved' : 'Save'}
                </Button>
              </Col>
            </Row>
          </Card>
        );
      })}

      {/* DEDICATED SECTION FOR VIP GUEST PRIZE (AFTER ROUND 9) */}
      <div style={{ fontWeight: 800, fontSize: 16, color: '#4A154B', marginTop: 28, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Crown size={18} style={{ color: '#7B1FA2' }} /> VIP Guest Playing Zone Prize:
      </div>

      <Card
        key={10}
        style={{
          marginBottom: 24,
          borderLeft: '5px solid #7B1FA2',
          background: 'linear-gradient(135deg, #fcfaff 0%, #f6ecff 100%)',
          boxShadow: '0 4px 16px rgba(123,31,162,0.1)',
        }}
        bodyStyle={{ padding: '18px 22px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 10 }}>
          <Tag color="purple" style={{ fontWeight: 800, fontSize: 13 }}>VIP GUEST PRIZE</Tag>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#4A154B' }}>
            Special VIP Guest Lucky Draw (Roulette Wheel Winner)
          </span>
          {saved[10] && <Tag color="success">✓ Saved</Tag>}
        </div>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} sm={7}>
            <Input
              placeholder="Prize Name (e.g. VIP Mega Gift Hamper)"
              value={guestPrize.name}
              onChange={e => update(10, 'name', e.target.value)}
              prefix={<span style={{ color: '#7B1FA2' }}>👑</span>}
            />
          </Col>
          <Col xs={24} sm={7}>
            <Input
              placeholder="Description (e.g. Special Honored Guest Gift)"
              value={guestPrize.description}
              onChange={e => update(10, 'description', e.target.value)}
            />
          </Col>
          <Col xs={24} sm={7}>
            <Input
              placeholder="Image URL link (optional)"
              value={guestPrize.imageUrl}
              onChange={e => update(10, 'imageUrl', e.target.value)}
              prefix="🖼"
            />
          </Col>
          <Col xs={24} sm={3}>
            <Button
              block
              type={saved[10] ? 'default' : 'primary'}
              loading={saving[10]}
              onClick={() => saveOne(10)}
              style={saved[10] ? { borderColor: '#52c41a', color: '#52c41a' }
                              : { background: '#7B1FA2', borderColor: '#7B1FA2', fontWeight: 800 }}
            >
              {saved[10] ? '✓ Saved' : 'Save'}
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

function EmployeesTab({ summary, onRefresh }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [uploadMode, setUploadMode] = useState('replace');
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Add employee manually modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addingManual, setAddingManual] = useState(false);

  // Edit employee modal
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get('/api/employees', auth())
      .then(r => setData(r.data))
      .catch(() => message.error('Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleManualAddFinish = async (values) => {
    setAddingManual(true);
    try {
      const { data: res } = await axios.post('/api/employees/add', values, auth());
      message.success(`Employee "${values.name}" added to the end of directory as #${res.employee?.serialNo || 'last'}`);
      setIsAddModalOpen(false);
      addForm.resetFields();
      load();
      if (onRefresh) onRefresh();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to add employee');
    } finally {
      setAddingManual(false);
    }
  };

  const handleUpload = async ({ file }) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', uploadMode);
    try {
      const { data: res } = await axios.post('/api/employees/upload', fd, auth());
      message.success(res.message || `${res.total} employees uploaded successfully!`);
      setSelectedRowKeys([]);
      load();
      if (onRefresh) onRefresh();
    } catch (e) {
      message.error(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "Name of Employee,Pay Code,Unit,Department,Designation\n" +
      "Rahul Sharma,PT200001,PGTL,PAINT SHOP,Manager\n" +
      "Priya Patel,PT200002,NGM,QUALITY,Executive\n" +
      "Amit Kumar,PT200003,PGTL,PRODUCTION,Supervisor\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employee_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/employees/${id}`, auth());
      message.success('Employee deleted directly from database');
      load();
      if (onRefresh) onRefresh();
    } catch (e) {
      message.error(e.response?.data?.message || 'Delete failed');
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBatchDeleting(true);
    try {
      const { data: res } = await axios.post('/api/employees/batch-delete', { ids: selectedRowKeys }, auth());
      message.success(res.message || 'Selected employees deleted from database');
      setSelectedRowKeys([]);
      load();
      if (onRefresh) onRefresh();
    } catch (e) {
      message.error(e.response?.data?.message || 'Batch delete failed');
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      await axios.delete('/api/employees/all', auth());
      message.success('All employees permanently cleared from database');
      setData([]);
      setSelectedRowKeys([]);
      load();
      if (onRefresh) onRefresh();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to clear employees');
    } finally {
      setClearingAll(false);
    }
  };

  const openEditModal = (record) => {
    setEditingEmployee(record);
    editForm.setFieldsValue({
      name: record.name,
      payCode: record.payCode,
      unit: record.unit,
      department: record.department,
      designation: record.designation,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setSavingEdit(true);
      await axios.put(`/api/employees/${editingEmployee._id}`, values, auth());
      message.success('Employee updated in database');
      setEditModalVisible(false);
      setEditingEmployee(null);
      load();
      if (onRefresh) onRefresh();
    } catch (e) {
      if (e.response?.data?.message) {
        message.error(e.response.data.message);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredData = data.filter(item => {
    const matchesGroup = selectedGroup === 'all' || String(item.group) === String(selectedGroup);
    if (!matchesGroup) return false;
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.payCode && item.payCode.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q)) ||
      (item.designation && item.designation.toLowerCase().includes(q)) ||
      (item.unit && item.unit.toLowerCase().includes(q)) ||
      (String(item.serialNo).includes(q))
    );
  });

  const GROUP_COLORS = { 1: 'blue', 2: 'purple', 3: 'green' };

  // ── TABLE COLUMNS: GENDER & WON COLUMNS REMOVED AS REQUESTED ──
  const cols = [
    { title: '#', dataIndex: 'serialNo', width: 65, sorter: (a, b) => a.serialNo - b.serialNo },
    {
      title: 'Group',
      dataIndex: 'group',
      width: 95,
      render: g => <Tag color={GROUP_COLORS[g] || 'default'}>Grp {['A', 'B', 'C'][g - 1] || g}</Tag>,
      filters: [
        { text: 'Group A', value: 1 },
        { text: 'Group B', value: 2 },
        { text: 'Group C', value: 3 },
      ],
      onFilter: (value, record) => record.group === value,
    },
    { title: 'Pay Code', dataIndex: 'payCode', width: 120 },
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    { title: 'Unit', dataIndex: 'unit', width: 90 },
    { title: 'Department', dataIndex: 'department', ellipsis: true },
    { title: 'Designation', dataIndex: 'designation', ellipsis: true },
    {
      title: 'Action',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(r)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this employee?"
            description={`Delete ${r.name} (#${r.serialNo}) directly from database?`}
            onConfirm={() => handleDelete(r._id)}
            okText="Yes, Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button size="small" danger type="link" icon={<DeleteOutlined />}>
              Del
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  // Compute exact serial number ranges for Group A, B, C
  const totalEmployees = summary?.total || data.length;
  const countA = summary?.groups?.[1] || 0;
  const countB = summary?.groups?.[2] || 0;
  const countC = summary?.groups?.[3] || 0;

  const rangeA = countA > 0 ? `1 – ${countA}` : '—';
  const rangeB = countB > 0 ? `${countA + 1} – ${countA + countB}` : '—';
  const rangeC = countC > 0 ? `${countA + countB + 1} – ${totalEmployees || countA + countB + countC}` : '—';

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* 1. Statistics Cards with Counting & Mention of Serial Ranges (e.g. Group A: 243 (1 - 243)) */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px 20px' }} style={{ borderRadius: 12 }}>
            <Statistic
              title={<span style={{ fontWeight: 700, color: '#64748b', fontSize: 13 }}>Total Employees</span>}
              value={totalEmployees}
              valueStyle={{ color: '#C8102E', fontWeight: 800, fontSize: 26 }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#888', fontWeight: 600 }}>
              Active in Directory
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px 20px' }} style={{ borderRadius: 12, borderTop: '3px solid #1677ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Statistic
                title={<span style={{ fontWeight: 700, color: '#1677ff', fontSize: 13 }}>Group A</span>}
                value={countA}
                valueStyle={{ color: '#1677ff', fontWeight: 800, fontSize: 26 }}
              />
              <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6, fontSize: 12, padding: '2px 8px', margin: 0 }}>
                {rangeA}
              </Tag>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#1677ff', fontWeight: 600 }}>
              Group A = <b>{countA}</b> ({rangeA})
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px 20px' }} style={{ borderRadius: 12, borderTop: '3px solid #722ed1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Statistic
                title={<span style={{ fontWeight: 700, color: '#722ed1', fontSize: 13 }}>Group B</span>}
                value={countB}
                valueStyle={{ color: '#722ed1', fontWeight: 800, fontSize: 26 }}
              />
              <Tag color="purple" style={{ fontWeight: 700, borderRadius: 6, fontSize: 12, padding: '2px 8px', margin: 0 }}>
                {rangeB}
              </Tag>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#722ed1', fontWeight: 600 }}>
              Group B = <b>{countB}</b> ({rangeB})
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px 20px' }} style={{ borderRadius: 12, borderTop: '3px solid #52c41a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Statistic
                title={<span style={{ fontWeight: 700, color: '#52c41a', fontSize: 13 }}>Group C</span>}
                value={countC}
                valueStyle={{ color: '#52c41a', fontWeight: 800, fontSize: 26 }}
              />
              <Tag color="green" style={{ fontWeight: 700, borderRadius: 6, fontSize: 12, padding: '2px 8px', margin: 0 }}>
                {rangeC}
              </Tag>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#52c41a', fontWeight: 600 }}>
              Group C = <b>{countC}</b> ({rangeC})
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. Upload Employee (Minimised Width) & Add Employee Manually (Side-by-Side in Same Row) */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {/* Column A: Upload Employees (Excel / CSV) */}
        <Col xs={24} lg={15}>
          <Card
            style={{ height: '100%', borderRadius: 12 }}
            title={
              <Space>
                <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                <span style={{ fontWeight: 700 }}>Upload Employees (Excel / CSV)</span>
              </Space>
            }
            extra={
              <Button icon={<DownloadOutlined />} size="small" onClick={downloadSampleTemplate}>
                Sample CSV
              </Button>
            }
          >
            <p style={{ color: '#666', marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
              Upload your <b>Excel (.xlsx, .xls)</b> or <b>CSV</b> file. Serial numbers and equal groups (A, B, C) are automatically assigned.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <Upload
                beforeUpload={f => { handleUpload({ file: f }); return false; }}
                showUploadList={false}
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploading}
                  style={{ backgroundColor: '#C8102E', borderColor: '#C8102E', color: '#fff', fontWeight: 600, height: 40 }}
                >
                  {uploading ? 'Processing...' : 'Upload Excel / CSV'}
                </Button>
              </Upload>

              <Space align="center">
                <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>Mode:</span>
                <Select
                  value={uploadMode}
                  onChange={setUploadMode}
                  style={{ width: 190 }}
                  options={[
                    { value: 'replace', label: 'Replace (Fresh list)' },
                    { value: 'append', label: 'Append to Existing' },
                  ]}
                />
              </Space>
            </div>
          </Card>
        </Col>

        {/* Column B: Add Employee Manually (Popup Trigger Card) */}
        <Col xs={24} lg={9}>
          <Card
            style={{ height: '100%', borderRadius: 12 }}
            title={
              <Space>
                <UserPlus size={18} style={{ color: '#C8102E' }} />
                <span style={{ fontWeight: 700 }}>Add Employee Manually</span>
              </Space>
            }
          >
            <p style={{ color: '#666', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Register an individual employee. New entry is appended to the <b>last row</b> of the directory.
            </p>

            <Button
              type="primary"
              size="large"
              icon={<UserPlus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
              onClick={() => setIsAddModalOpen(true)}
              style={{
                width: '100%',
                background: '#C8102E',
                borderColor: '#C8102E',
                fontWeight: 700,
                height: 42,
                borderRadius: 8,
              }}
            >
              + Add Employee
            </Button>
          </Card>
        </Col>
      </Row>

      {/* ── POPUP MODAL: ADD EMPLOYEE MANUALLY ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
            <UserPlus size={20} style={{ color: '#C8102E' }} />
            <span style={{ fontWeight: 800, fontSize: 16 }}>Add Employee Manually</span>
          </div>
        }
        open={isAddModalOpen}
        onCancel={() => {
          if (!addingManual) {
            setIsAddModalOpen(false);
            addForm.resetFields();
          }
        }}
        footer={null}
        destroyOnClose
      >
        <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
          Fill in employee details below. This employee will be added to the <b>last row</b> of the directory with the next serial number.
        </p>

        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleManualAddFinish}
          requiredMark="optional"
        >
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 700 }}>Name of Employee *</span>}
            rules={[{ required: true, message: 'Please enter employee name' }]}
          >
            <Input placeholder="Enter full employee name" size="large" />
          </Form.Item>

          <Form.Item
            name="payCode"
            label={<span style={{ fontWeight: 700 }}>Pay Code / Emp Code</span>}
          >
            <Input placeholder="e.g. PT200150 or PG100280" size="large" />
          </Form.Item>

          <Form.Item
            name="unit"
            label={<span style={{ fontWeight: 700 }}>Unit</span>}
          >
            <Input placeholder="e.g. PGEL, PGTL, NGM" size="large" />
          </Form.Item>

          <Form.Item
            name="designation"
            label={<span style={{ fontWeight: 700 }}>Designation</span>}
          >
            <Input placeholder="e.g. Manager, Senior Officer, Technician" size="large" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button onClick={() => setIsAddModalOpen(false)} disabled={addingManual} size="large">
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={addingManual}
              icon={<UserPlus size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
              size="large"
              style={{ background: '#C8102E', borderColor: '#C8102E', fontWeight: 700 }}
            >
              Add to List
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 3. CRUD Table */}
      <Card
        title={
          <Space align="center">
            <Users size={18} style={{ color: '#1E88E5' }} />
            <span>Employees Directory ({filteredData.length} {filteredData.length !== data.length ? `filtered of ${data.length}` : 'total'})</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => { load(); if (onRefresh) onRefresh(); }}
              loading={loading}
            >
              Refresh
            </Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`Delete ${selectedRowKeys.length} selected employee(s)?`}
                description="This will permanently delete them directly from the database and recalculate serial numbers."
                onConfirm={handleBatchDelete}
                okText="Yes, Delete"
                okType="danger"
                cancelText="Cancel"
              >
                <Button danger type="primary" loading={batchDeleting} size="small" icon={<DeleteOutlined />}>
                  Delete Selected ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Popconfirm
              title="Permanently Clear ALL Employees?"
              description="This will delete every employee and winner record directly from the MongoDB database!"
              onConfirm={handleClearAll}
              okText="Yes, Delete All"
              okType="danger"
              cancelText="Cancel"
            >
              <Button danger size="small" loading={clearingAll}>Clear All</Button>
            </Popconfirm>
          </Space>
        }
      >
        {/* Search & Filter Toolbar */}
        <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={10}>
            <Input
              placeholder="Search by Name, Pay Code, Dept, Unit..."
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              value={selectedGroup}
              onChange={setSelectedGroup}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'All Groups' },
                { value: '1', label: 'Group A only' },
                { value: '2', label: 'Group B only' },
                { value: '3', label: 'Group C only' },
              ]}
            />
          </Col>
          {searchText && (
            <Col xs={24} sm={24} md={6}>
              <Button onClick={() => setSearchText('')} size="small">
                Reset Filter
              </Button>
            </Col>
          )}
        </Row>

        <Table
          rowSelection={rowSelection}
          dataSource={filteredData}
          columns={cols}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
          size="small"
          rowClassName={r => (r.hasWon ? 'bg-yellow-50' : '')}
        />
      </Card>

      {/* 5. Edit Employee Modal */}
      <Modal
        title={`✏️ Edit Employee (#${editingEmployee?.serialNo || ''} - ${editingEmployee?.name || ''})`}
        open={editModalVisible}
        onOk={handleSaveEdit}
        confirmLoading={savingEdit}
        onCancel={() => { setEditModalVisible(false); setEditingEmployee(null); }}
        okText="Save Changes to Database"
        cancelText="Cancel"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Employee Name" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="payCode" label="Pay Code">
                <Input placeholder="e.g. PT200016" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Unit">
                <Input placeholder="e.g. PGTL / NGM" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="gender" label="Gender">
                <Select
                  allowClear
                  placeholder="Select Gender"
                  options={[
                    { value: 'MALE', label: 'MALE' },
                    { value: 'FEMALE', label: 'FEMALE' },
                    { value: 'OTHER', label: 'OTHER' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="Department">
                <Input placeholder="e.g. PAINT SHOP, IDU" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="designation" label="Designation">
            <Input placeholder="e.g. Manager, Executive, Operator" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [page, setPage] = useState('game');
  const [gameState, setGameState] = useState(null);
  const [winners, setWinners] = useState([]);
  const [summary, setSummary] = useState({ total: 0, groups: { 1: 0, 2: 0, 3: 0 } });
  const [prizes, setPrizes] = useState(Array.from({ length: 10 }, (_, i) => ({ roundNo: i + 1, name: '', description: '', imageUrl: '' })));
  const [isEditingPrizes, setIsEditingPrizes] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [prizeForm] = Form.useForm();

  // Guest draw state
  const [guestState, setGuestState] = useState(null);
  const [guestSpinning, setGuestSpinning] = useState(false);
  const [showFiestaWinners, setShowFiestaWinners] = useState(false);
  const [togglingFiesta, setTogglingFiesta] = useState(false);

  const toggleFiestaWinners = async () => {
    setTogglingFiesta(true);
    try {
      const res = await axios.post('/api/game/show-fiesta-winners', { show: !showFiestaWinners }, auth());
      setShowFiestaWinners(res.data.showFiestaWinners);
      if (res.data.showFiestaWinners) {
        message.success('🏆 "PG - FORTUNE FIESTA WINNERS" ceremony is now LIVE on Audience Screen with music & sparkles!');
      } else {
        message.info('Returned Audience Screen to normal Draw mode.');
      }
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to toggle Fiesta Winners screen');
    } finally {
      setTogglingFiesta(false);
    }
  };

  const loadGuestState = useCallback(async () => {
    try {
      const res = await axios.get('/api/guests/state', auth());
      setGuestState(res.data);
      if (res.data.spinning) setGuestSpinning(true);
      else setGuestSpinning(false);
    } catch {}
  }, []);

  const spinGuest = async () => {
    setGuestSpinning(true);
    try {
      await axios.post('/api/guests/spin', {}, auth());
      message.success('VIP Guest Roulette spinning for 30s on Live screen!');
      setTimeout(() => {
        setGuestSpinning(false);
        loadGuestState();
      }, 30500);
    } catch (e) {
      message.error(e.response?.data?.message || 'Guest spin failed');
      setGuestSpinning(false);
    }
  };

  const revertGuest = async () => {
    try {
      await axios.post('/api/guests/revert', {}, auth());
      message.success('Guest winner reverted. Guest returned to eligible pool. Ready to spin again!');
      loadGuestState();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to revert winner');
    }
  };

  const resetGuest = async () => {
    try {
      await axios.post('/api/guests/reset', {}, auth());
      message.success('Guest draw reset');
      loadGuestState();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to reset guest draw');
    }
  };

  const loadState = useCallback(async () => {
    try {
      const [stateRes, summaryRes, prizesRes] = await Promise.all([
        axios.get('/api/game/state', auth()),
        axios.get('/api/employees/summary', auth()),
        axios.get('/api/prizes', auth()),
      ]);
      setGameState(stateRes.data.state);
      setShowFiestaWinners(Boolean(stateRes.data.state?.showFiestaWinners));
      setWinners(stateRes.data.winners);
      setSummary(summaryRes.data);
      if (prizesRes.data.length > 0) {
        const merged = Array.from({ length: 10 }, (_, i) => {
          const found = prizesRes.data.find(p => p.roundNo === i + 1);
          return found || { roundNo: i + 1, name: '', description: '', imageUrl: '' };
        });
        setPrizes(merged);
        prizeForm.setFieldsValue({ prizes: merged });
      }
      loadGuestState();
    } catch (e) {
      if (e.response?.status === 401) navigate('/admin/login');
    }
  }, [loadGuestState, navigate, prizeForm]);

  useEffect(() => {
    loadState();
    const t = setInterval(() => {
      loadState();
      loadGuestState();
    }, 5000);
    return () => clearInterval(t);
  }, [loadState, loadGuestState]);

  const startGame = async () => {
    try { 
      await axios.post('/api/game/start', {}, auth()); 
      message.success('Game started!'); 
      loadState(); 
    }
    catch (e) { 
      console.error('Start Game Error:', e.response?.data || e);
      message.error(e.response?.data?.message || 'Error starting game'); 
    }
  };

  const spin = async () => {
    setSpinning(true);
    try {
      await axios.post('/api/game/spin', {}, auth());
      message.success('Spinning (20 seconds)...');
      setTimeout(() => { setSpinning(false); loadState(); }, 20500);
    } catch (e) { message.error(e.response?.data?.message || 'Error'); setSpinning(false); }
  };

  const nextRound = async () => {
    try { await axios.post('/api/game/next-round', {}, auth()); message.success('Next round!'); loadState(); }
    catch (e) { message.error(e.response?.data?.message || 'Error'); }
  };

  const resetGame = async () => {
    try { await axios.post('/api/game/reset', {}, auth()); message.success('Game reset'); loadState(); }
    catch (e) { message.error(e.response?.data?.message || 'Error'); }
  };

  const savePrizes = async () => {
    const vals = prizeForm.getFieldValue('prizes');
    try { await axios.post('/api/prizes/batch', { prizes: vals }, auth()); message.success('Prizes saved!'); loadState(); }
    catch { message.error('Failed to save prizes'); }
  };

  const currentRound = gameState?.currentRound || 1;
  const currentGroup = roundToGroup(currentRound);
  const status = gameState?.status || 'idle';
  const isActive = gameState?.isActive || false;

  const winnerColumns = [
    { title: 'Round', dataIndex: 'roundNo', width: 85, render: r => <Tag color="red">{ROUND_NAMES[r] || `R${r}`}</Tag> },
    { title: 'Group', dataIndex: 'group', width: 95, render: g => <Tag color={GROUP_COLORS[g]}>{GROUP_LABELS[g]}</Tag> },
    { title: 'Emp Code', dataIndex: 'winnerNumber', width: 120, render: (code, r) => <b style={{ color: '#C8102E' }}>{code || r.employeeCode || r.employee?.payCode || '—'}</b> },
    { title: 'Name', dataIndex: ['employee', 'name'], render: v => v || '—' },
    { title: 'Unit', dataIndex: ['employee', 'unit'], render: v => v || '—' },
    { title: 'Department', dataIndex: ['employee', 'department'], render: v => v || '—' },
    { title: 'Prize', dataIndex: ['prize', 'name'], render: v => v || <span className="text-gray-400">—</span> },
  ];

  return (
    <Layout className="min-h-screen" style={{ background: '#f8fafc' }}>
      {/* ── FIXED TOP NAVBAR ── */}
      <Header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: 64,
          zIndex: 1000,
          background: '#ffffff',
          borderBottom: '2px solid #C8102E',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={LOGO} alt="PG" style={{ height: 42, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 18, color: '#1a1a1a', letterSpacing: -0.2 }}>
            Fortune Fiesta Lucky Draw
          </span>
        </div>

        <Space size={14} align="center">
          <Button
            type="default"
            icon={<ExternalLink size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
            onClick={() => window.open('/live', '_blank')}
            style={{
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 8,
              height: 38,
            }}
          >
            Live Screen
          </Button>
          <Button
            danger
            type="primary"
            icon={<LogOut size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
            onClick={() => {
              localStorage.removeItem('pg_admin_token');
              navigate('/admin/login');
            }}
            style={{
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 8,
              background: '#C8102E',
              height: 38,
            }}
          >
            Logout
          </Button>

          {/* Attractive Admin Portal Badge with Avatar at the right end */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 14px 4px 6px',
              background: 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)',
              border: '1.5px solid #fee2e2',
              borderRadius: 30,
              boxShadow: '0 2px 6px rgba(200, 16, 46, 0.08)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C8102E 0%, #8B0000 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(200, 16, 46, 0.35)',
              }}
            >
              <ShieldCheck size={18} strokeWidth={2.4} color="#ffffff" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', letterSpacing: 0.2 }}>
                Admin Portal
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Online
              </span>
            </div>
          </div>
        </Space>
      </Header>

      {/* ── INNER LAYOUT (STARTING BELOW 64px FIXED HEADER) ── */}
      <Layout style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', background: '#f8fafc' }}>
        {/* ── FIXED ATTRACTIVE SIDEBAR WITH LUCIDE REACT ICONS ── */}
        <Sider
          width={240}
          style={{
            position: 'fixed',
            top: 64,
            left: 0,
            bottom: 0,
            height: 'calc(100vh - 64px)',
            background: '#ffffff',
            borderRight: '1px solid #eef2f6',
            boxShadow: '2px 0 12px rgba(0,0,0,0.03)',
            zIndex: 999,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Section Header */}
          <div
            style={{
              padding: '18px 20px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#94a3b8',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Navigation
            </span>
            <span
              style={{
                fontSize: 10,
                background: '#f1f5f9',
                color: '#475569',
                padding: '2px 7px',
                borderRadius: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              MENU
            </span>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[page]}
            style={{
              borderRight: 0,
              background: 'transparent',
              padding: '0 8px 90px 8px',
            }}
            onClick={({ key }) => setPage(key)}
            items={[
              {
                key: 'game',
                icon: (
                  <Gamepad2
                    size={18}
                    strokeWidth={2.2}
                    style={{
                      color: page === 'game' ? '#C8102E' : '#64748b',
                      transition: 'color 0.2s',
                    }}
                  />
                ),
                label: (
                  <span style={{ fontWeight: page === 'game' ? 700 : 500, fontSize: 14 }}>
                    Game Control
                  </span>
                ),
              },
              {
                key: 'cards',
                icon: (
                  <IdCard
                    size={18}
                    strokeWidth={2.2}
                    style={{
                      color: page === 'cards' ? '#7B1FA2' : '#64748b',
                      transition: 'color 0.2s',
                    }}
                  />
                ),
                label: (
                  <span style={{ fontWeight: page === 'cards' ? 700 : 500, fontSize: 14 }}>
                    Cards Studio
                  </span>
                ),
              },
              {
                key: 'guests',
                icon: (
                  <Crown
                    size={18}
                    strokeWidth={2.2}
                    style={{
                      color: page === 'guests' ? '#7B1FA2' : '#64748b',
                      transition: 'color 0.2s',
                    }}
                  />
                ),
                label: (
                  <span style={{ fontWeight: page === 'guests' ? 700 : 500, fontSize: 14 }}>
                    VIP Guests
                  </span>
                ),
              },
              {
                key: 'employees',
                icon: (
                  <Users
                    size={18}
                    strokeWidth={2.2}
                    style={{
                      color: page === 'employees' ? '#1E88E5' : '#64748b',
                      transition: 'color 0.2s',
                    }}
                  />
                ),
                label: (
                  <span style={{ fontWeight: page === 'employees' ? 700 : 500, fontSize: 14 }}>
                    Employees Directory
                  </span>
                ),
              },
              {
                key: 'prizes',
                icon: (
                  <Gift
                    size={18}
                    strokeWidth={2.2}
                    style={{
                      color: page === 'prizes' ? '#E65100' : '#64748b',
                      transition: 'color 0.2s',
                    }}
                  />
                ),
                label: (
                  <span style={{ fontWeight: page === 'prizes' ? 700 : 500, fontSize: 14 }}>
                    Prizes Setup
                  </span>
                ),
              },
              {
                key: 'winners',
                icon: (
                  <Trophy
                    size={18}
                    strokeWidth={2.2}
                    style={{
                      color: page === 'winners' ? '#D4AF37' : '#64748b',
                      transition: 'color 0.2s',
                    }}
                  />
                ),
                label: (
                  <span style={{ fontWeight: page === 'winners' ? 700 : 500, fontSize: 14 }}>
                    Winners History
                  </span>
                ),
              },
            ]}
          />

          {/* Bottom Live System Indicator Badge — Pinned at bottom of sidebar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '14px 20px',
              borderTop: '1px solid #f1f5f9',
              background: '#fbfcfd',
              boxShadow: '0 -2px 10px rgba(0,0,0,0.02)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                Admin Console Online
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, paddingLeft: 16 }}>
              PG Fortune Fiesta 2026
            </div>
          </div>
        </Sider>

        {/* ── SCROLLABLE MAIN CONTENT (MARGIN-LEFT 240px TO PREVENT OVERLAP) ── */}
        <Content
          style={{
            marginLeft: 240,
            minHeight: 'calc(100vh - 64px)',
            padding: '24px 32px',
            background: '#f8fafc',
          }}
        >

          {/* GAME CONTROL */}
          {page === 'game' && (
            <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Row gutter={16}>
                {[
                  { label: 'Total', value: summary.total, color: '#C8102E' },
                  { label: 'Group A', value: summary.groups?.[1] || 0 },
                  { label: 'Group B', value: summary.groups?.[2] || 0 },
                  { label: 'Group C', value: summary.groups?.[3] || 0 },
                ].map(s => (
                  <Col span={6} key={s.label}>
                    <Card><Statistic title={s.label} value={s.value} valueStyle={s.color ? { color: s.color, fontWeight: 700 } : {}} /></Card>
                  </Col>
                ))}
              </Row>

              {/* 1. EMPLOYEE GAME CONTROL (ROUNDS 1A-3C) */}
              <Card
                title={
                  <Space align="center">
                    <Gamepad2 size={18} style={{ color: '#C8102E' }} />
                    <span style={{ fontWeight: 700 }}>Employee Game Control (Rounds 1A–3C)</span>
                    {isActive && <Badge status={status === 'spinning' ? 'processing' : 'success'} text={status === 'spinning' ? 'Spinning...' : status === 'revealed' ? 'Winner Revealed' : 'Ready'} />}
                  </Space>
                }
                extra={<Popconfirm title="Reset entire employee game?" onConfirm={resetGame}><Button icon={<ReloadOutlined />} danger size="small">Reset</Button></Popconfirm>}
              >
                {isActive ? (
                  <div>
                    <Alert
                      type="info"
                      style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8 }}
                      message={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>
                            Active Round: <span style={{ color: '#C8102E', fontSize: 16 }}>{ROUND_NAMES[currentRound] || currentRound}</span> / 9
                            &nbsp;&nbsp;|&nbsp;&nbsp;
                            <Tag color={GROUP_COLORS[currentGroup]} style={{ fontWeight: 700 }}>{GROUP_LABELS[currentGroup]}</Tag>
                          </span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            Completed: <strong style={{ color: '#16a34a' }}>{winners.length}</strong> / 9 rounds
                          </span>
                        </div>
                      }
                    />

                    {/* All 9 rounds in ONE single compact row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
                        gap: 6,
                        marginBottom: 16,
                      }}
                    >
                      {Array.from({ length: 9 }, (_, i) => {
                        const r = i + 1;
                        const w = winners.find(win => win.roundNo === r);
                        const isCurrent = r === currentRound;
                        return (
                          <div
                            key={r}
                            style={{
                              padding: '7px 4px',
                              borderRadius: 8,
                              border: `2px solid ${isCurrent ? '#C8102E' : w ? '#52c41a' : '#e2e8f0'}`,
                              background: isCurrent ? '#fff1f2' : w ? '#f0fdf4' : '#fafafa',
                              textAlign: 'center',
                              minWidth: 0,
                              boxShadow: isCurrent ? '0 0 0 1px #C8102E, 0 2px 6px rgba(200,16,46,0.15)' : 'none',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10.5,
                                color: isCurrent ? '#9f1239' : w ? '#166534' : '#64748b',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: 1.2,
                              }}
                              title={`${ROUND_NAMES[r]} · ${GROUP_LABELS[roundToGroup(r)]}`}
                            >
                              {ROUND_NAMES[r]} · {GROUP_LABELS[roundToGroup(r)]}
                            </div>
                            {w ? (
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#16a34a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: 4,
                                  lineHeight: 1.2,
                                }}
                                title={`Winner: #${w.winnerNumber}`}
                              >
                                #{w.winnerNumber}
                              </div>
                            ) : (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: isCurrent ? 700 : 500,
                                  color: isCurrent ? '#C8102E' : '#94a3b8',
                                  marginTop: 4,
                                  lineHeight: 1.2,
                                }}
                              >
                                {isCurrent ? '← now' : '—'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {gameState?.status === 'revealed' && (
                      <div style={{
                        margin: '12px 0 16px',
                        padding: '12px 18px',
                        background: '#fff8e6',
                        border: '2px dashed #D4AF37',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#8B6914', fontSize: 14 }}>
                            ⚠️ Winner not present?
                          </div>
                          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                            If the card holder is absent or card is missing, spin again for a new winner.
                            The previous number will be excluded.
                          </div>
                        </div>
                        <Button
                          danger
                          size="large"
                          loading={spinning}
                          onClick={async () => {
                            setSpinning(true);
                            try {
                              await axios.post('/api/game/spin-again', {}, {
                                headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` }
                              });
                              message.info('Spinning again (20 seconds) for Round ' + gameState.currentRound);
                              setTimeout(() => { setSpinning(false); loadState(); }, 20500);
                            } catch (e) {
                              message.error(e.response?.data?.message || 'Error');
                              setSpinning(false);
                            }
                          }}
                          style={{ whiteSpace: 'nowrap', minWidth: 140, height: 44 }}
                        >
                          🔄 Spin Again
                        </Button>
                      </div>
                    )}

                    <Space size="middle">
                      <Button
                        type="primary" size="large" icon={<PlayCircleOutlined />}
                        loading={spinning} onClick={spin}
                        disabled={status === 'spinning' || currentRound > 9}
                        style={{ backgroundColor: '#C8102E', borderColor: '#C8102E', height: 48, paddingInline: 32, fontSize: 16, fontWeight: 700 }}
                      >
                        🎰 SPIN Round {currentRound}
                      </Button>
                      <Button
                        size="large" icon={<StepForwardOutlined />} onClick={nextRound}
                        disabled={status !== 'revealed' || currentRound >= 9}
                        style={{ height: 48, paddingInline: 24, fontWeight: 600 }}
                      >
                        Next Round →
                      </Button>
                    </Space>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🪔</div>
                    {summary.total === 0
                      ? <p style={{ color: '#888', marginBottom: 16 }}>Configure cards first to start.</p>
                      : <p style={{ color: '#555', marginBottom: 16 }}><strong>{summary.total} cards</strong> ready across 3 groups.</p>
                    }
                    <Button type="primary" size="large" onClick={startGame} disabled={summary.total === 0}
                      style={{ backgroundColor: '#C8102E', borderColor: '#C8102E', height: 52, paddingInline: 56, fontSize: 18, fontWeight: 700 }}>
                      🪔 Start Lucky Draw
                    </Button>
                  </div>
                )}
              </Card>

              {/* 2. VIP GUEST PLAYING ZONE */}
              <Card
                style={{ borderTop: '4px solid #7B1FA2' }}
                title={
                  <Space align="center">
                    <Crown size={19} style={{ color: '#7B1FA2' }} />
                    <span style={{ fontWeight: 800, color: '#4A154B' }}>VIP Guest Playing Zone (Roulette Draw — 1 Winner Round)</span>
                    <Badge
                      status={guestSpinning || guestState?.status === 'spinning' ? 'processing' : guestState?.winner ? 'success' : 'default'}
                      text={guestSpinning || guestState?.status === 'spinning' ? 'Roulette Spinning (30s)...' : guestState?.winner ? 'Guest Winner Revealed' : 'Ready'}
                    />
                  </Space>
                }
                extra={
                  <Popconfirm title="Reset VIP Guest Draw?" onConfirm={resetGuest}>
                    <Button danger size="small" icon={<ReloadOutlined />}>Reset Guest</Button>
                  </Popconfirm>
                }
              >
                <Row gutter={[16, 12]} align="middle">
                  <Col xs={24} sm={13}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                      VIP Guests in Pool: <span style={{ color: '#7B1FA2', fontWeight: 800 }}>{guestState?.total || 0} Guests</span>
                      {guestState?.eligibleCount !== undefined && (
                        <span style={{ color: '#52c41a', marginLeft: 10, fontSize: 13, fontWeight: 600 }}>
                          ({guestState.eligibleCount} eligible)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Single round casino roulette wheel with 30-second suspense countdown & celebration on Live Screen.
                    </div>
                  </Col>
                  <Col xs={24} sm={11} style={{ textAlign: 'right' }}>
                    <Space wrap size="small">
                      <Button
                        type="primary"
                        size="large"
                        loading={guestSpinning || guestState?.status === 'spinning'}
                        onClick={spinGuest}
                        disabled={(guestState?.eligibleCount || 0) === 0 || guestSpinning || guestState?.status === 'spinning'}
                        icon={<Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                        style={{ background: '#7B1FA2', borderColor: '#7B1FA2', fontWeight: 800, height: 44, paddingInline: 24 }}
                      >
                        SPIN Guest Roulette (30s)
                      </Button>
                      <Button
                        size="large"
                        onClick={() => window.open('/live', '_blank')}
                        icon={<Tv size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                        style={{ height: 44, fontWeight: 600 }}
                      >
                        View Live Screen
                      </Button>
                    </Space>
                  </Col>
                </Row>

                {/* Guest Winner Display & Revert Option */}
                {guestState?.winner && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #fbf7ff 0%, #f3e8ff 100%)',
                      border: '2px solid #7B1FA2',
                      borderRadius: 12,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginTop: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#7B1FA2', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Crown size={15} /> VIP GUEST WINNER DRAWN:
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: '#1a1a1a', marginTop: 2 }}>
                        #{guestState.winner.serialNo} — {guestState.winner.name} &nbsp;
                        <Tag color="purple" style={{ fontSize: 12, fontWeight: 700 }}>Unit: {guestState.winner.unit || 'PGTL'}</Tag>
                      </div>
                      {guestState.prize?.name && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#B8860B', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Gift size={15} /> Won Prize: {guestState.prize.name} {guestState.prize.description && `(${guestState.prize.description})`}
                        </div>
                      )}
                    </div>

                    <Popconfirm
                      title="Guest not present / available?"
                      description="Clicking revert returns this guest to eligible pool so you can spin again!"
                      onConfirm={revertGuest}
                      okText="Revert & Spin Again"
                      okType="danger"
                    >
                      <Button
                        danger
                        size="middle"
                        icon={<RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                        style={{ height: 40, fontWeight: 700 }}
                      >
                        Revert (Guest Not Available)
                      </Button>
                    </Popconfirm>
                  </div>
                )}
              </Card>

              {/* 3. AUDIENCE SCREEN DISPLAY: PG - FORTUNE FIESTA WINNERS */}
              <Card
                style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #1e1b4b 100%)',
                  border: '2px solid #D4AF37',
                  borderRadius: 14,
                  boxShadow: '0 8px 24px rgba(212,175,55,0.22)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#FFD700', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Trophy size={20} style={{ color: '#FFD700' }} />
                      <span>Audience Screen Display: PG - FORTUNE FIESTA WINNERS</span>
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
                      Click below to broadcast the complete VIP Guest & Employee Winners ceremony to the Audience Live Screen (/live) with celebratory music & continuous sparkles.
                    </div>
                  </div>
                  <Space size="middle">
                    <Button
                      type="primary"
                      size="large"
                      icon={<Trophy size={17} />}
                      loading={togglingFiesta}
                      onClick={toggleFiestaWinners}
                      style={{
                        background: showFiestaWinners
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #B8860B 100%)',
                        borderColor: '#FFD700',
                        color: '#000',
                        fontWeight: 900,
                        fontSize: 15,
                        height: 46,
                        paddingInline: 24,
                        boxShadow: '0 4px 14px rgba(255,215,0,0.35)',
                      }}
                    >
                      {showFiestaWinners ? '✅ Fiesta Winners Live (Click to Return)' : '🏆 To Show Fiesta Winners'}
                    </Button>
                    <Button
                      size="large"
                      icon={<ExternalLink size={16} />}
                      onClick={() => window.open('/live', '_blank')}
                      style={{ height: 46, fontWeight: 700 }}
                    >
                      View Live Screen ↗
                    </Button>
                  </Space>
                </div>
              </Card>
            </div>
          )}

          {/* CARDS */}
          {page === 'cards' && (
            <CardsTab />
          )}

          {/* PRIZES */}
          {page === 'prizes' && (
            <PrizesTab />
          )}

          {/* WINNERS */}
          {page === 'winners' && (
            <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Display Control Bar */}
              <Card
                style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #1e1b4b 100%)',
                  border: '2px solid #D4AF37',
                  borderRadius: 14,
                  boxShadow: '0 6px 20px rgba(212,175,55,0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#FFD700', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Trophy size={22} style={{ color: '#FFD700' }} />
                      <span>PG FORTUNE FIESTA 2026 — OFFICIAL WINNERS PORTAL</span>
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
                      Records for all 9 Employee Rounds (Group A, Group B, Group C) and the Honored VIP Guest Round.
                    </div>
                  </div>
                  <Space>
                    <Button
                      type="primary"
                      size="large"
                      icon={<Trophy size={16} />}
                      loading={togglingFiesta}
                      onClick={toggleFiestaWinners}
                      style={{
                        background: showFiestaWinners
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #B8860B 100%)',
                        borderColor: '#FFD700',
                        color: '#000',
                        fontWeight: 900,
                        height: 44,
                      }}
                    >
                      {showFiestaWinners ? '✅ Fiesta Winners Live (Click to Hide)' : '🏆 To Show Fiesta Winners'}
                    </Button>
                    <Button
                      size="large"
                      icon={<ExternalLink size={16} />}
                      onClick={() => window.open('/live', '_blank')}
                      style={{ height: 44, fontWeight: 700 }}
                    >
                      Live Screen ↗
                    </Button>
                  </Space>
                </div>
              </Card>

              {/* 1. EMPLOYEE SECTION (GROUP A, GROUP B, GROUP C) */}
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 10 }}>
                    <Space align="center">
                      <Gamepad2 size={19} style={{ color: '#C8102E' }} />
                      <span style={{ fontWeight: 800, fontSize: 16 }}>
                        Employee Lucky Draw Winners ({winners.length} / 9 Rounds Complete)
                      </span>
                    </Space>
                    <Space size="small">
                      <Tag color="blue" style={{ fontWeight: 700 }}>Group A: {winners.filter(w => w.group === 1).length} / 3</Tag>
                      <Tag color="purple" style={{ fontWeight: 700 }}>Group B: {winners.filter(w => w.group === 2).length} / 3</Tag>
                      <Tag color="green" style={{ fontWeight: 700 }}>Group C: {winners.filter(w => w.group === 3).length} / 3</Tag>
                    </Space>
                  </div>
                }
                style={{ borderRadius: 12, border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
              >
                <Table
                  dataSource={winners}
                  columns={winnerColumns}
                  rowKey="_id"
                  pagination={false}
                  locale={{ emptyText: 'No employee winners drawn yet' }}
                />
              </Card>

              {/* 2. VIP GUEST WINNING SECTION (BELOW EMPLOYEE SECTION) */}
              <Card
                style={{
                  borderRadius: 14,
                  border: '2px solid #7B1FA2',
                  boxShadow: '0 6px 20px rgba(123,31,162,0.12)',
                  background: '#ffffff',
                }}
                title={
                  <Space align="center">
                    <Crown size={20} style={{ color: '#7B1FA2' }} />
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#4A154B' }}>
                      Honored VIP Guest Winner (Roulette Draw)
                    </span>
                    {guestState?.winner ? (
                      <Tag color="purple" style={{ fontWeight: 800, fontSize: 12 }}>
                        ★ WINNER DECLARED ★
                      </Tag>
                    ) : (
                      <Tag color="default">Pending Draw</Tag>
                    )}
                  </Space>
                }
              >
                {guestState?.winner ? (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                      border: '2px solid #7B1FA2',
                      borderRadius: 14,
                      padding: '20px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <div
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
                          border: '3px solid #FFD700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 15px rgba(123,31,162,0.3)',
                          flexShrink: 0,
                        }}
                      >
                        <Crown size={32} style={{ color: '#FFD700' }} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: '#7B1FA2',
                              color: '#FFD700',
                              fontWeight: 900,
                              fontSize: 13,
                              padding: '2px 10px',
                              borderRadius: 6,
                              letterSpacing: 0.5,
                            }}
                          >
                            LUCKY NO: #{guestState.winner.serialNo}
                          </span>
                          <span
                            style={{
                              background: '#FFD700',
                              color: '#581c87',
                              fontWeight: 900,
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 6,
                              letterSpacing: 0.5,
                            }}
                          >
                            ★ VIP PASS ★
                          </span>
                        </div>

                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 6, fontFamily: 'Georgia, serif' }}>
                          {guestState.winner.name}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>
                            Guest Unit: <b style={{ color: '#0f172a' }}>{guestState.winner.unit || 'PGTL'}</b>
                          </span>
                          {guestState.winner.guestNumber && (
                            <span style={{ fontSize: 13, color: '#64748b' }}>
                              Pass ID: #{guestState.winner.guestNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prize Info Card */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '2px solid #D4AF37',
                        borderRadius: 12,
                        padding: '14px 22px',
                        boxShadow: '0 4px 14px rgba(212,175,55,0.2)',
                        textAlign: 'left',
                        minWidth: 260,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#8B6914', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                        <Gift size={15} style={{ color: '#D4AF37' }} /> WON PRIZE
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: '#7B1FA2', marginTop: 2 }}>
                        {guestState.prize?.name || 'Grand Prize'}
                      </div>
                      {guestState.prize?.description && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {guestState.prize.description}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    icon={<Crown size={18} style={{ color: '#7B1FA2' }} />}
                    message={<span style={{ fontWeight: 700, color: '#4A154B' }}>VIP Guest Lucky Draw Pending</span>}
                    description="The Honored VIP Guest winner has not been drawn yet. Navigate to 'Game Control' and click 'SPIN Guest Roulette' to declare the winner."
                    style={{ background: '#faf5ff', border: '1.5px solid #ebd9f7', borderRadius: 10 }}
                  />
                )}
              </Card>
            </div>
          )}

          {/* EMPLOYEES */}
          {page === 'employees' && (
            <EmployeesTab summary={summary} onRefresh={loadState} />
          )}

          {/* GUESTS */}
          {page === 'guests' && (
            <GuestsTab onGuestChange={loadGuestState} />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
