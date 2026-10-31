import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          background: '#140020',
          color: '#ffffff',
          borderRadius: 16,
          margin: '20px auto',
          maxWidth: 600,
          border: '2px solid #D4AF37',
          boxShadow: '0 0 30px rgba(212,175,55,0.4)',
        }}>
          <h2 style={{ color: '#FFD700', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            ⚠️ Display Synchronization Notice
          </h2>
          <p style={{ color: '#e0c3fc', fontSize: 14, marginBottom: 20 }}>
            {this.state.error?.message || 'A transient display update occurred. Click below to resync.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
              window.location.reload();
            }}
            style={{
              background: 'linear-gradient(90deg, #C8102E, #7B1FA2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(200,16,46,0.4)',
            }}
          >
            🔄 Refresh & Re-sync Screen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
