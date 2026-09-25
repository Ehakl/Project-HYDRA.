import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      if (verificationStep) {
        await api.post('/auth/verify-email', { email, code: verificationCode });
        setVerificationStep(false);
        setIsRegister(false);
        setNotice('Email confirmed. You can sign in now.');
        return;
      }

      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? { email, password, name } : { email, password };
      
      const res = await api.post(endpoint, payload);
      
      if (isRegister) {
        setVerificationStep(true);
        setDevCode(res.data.devVerificationCode || '');
        setNotice(`We sent a six-digit code to ${email}.`);
      } else {
        login(res.data.token, res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  const resendCode = async () => {
    setError('');
    try {
      const res = await api.post('/auth/resend-verification', { email });
      setDevCode(res.data.devVerificationCode || '');
      setNotice('A new verification code was sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to resend the code');
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setVerificationStep(false);
    setError('');
    setNotice('');
    setDevCode('');
  };

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <span className="eyebrow">Document intelligence, distilled</span>
        <h1>Make every document<br /><em>work harder.</em></h1>
        <p>Hydra brings your files, search, and AI tools into one calm workspace built for getting to the useful part faster.</p>
        <div className="signal-list">
          <span><b>01</b> Search across your library</span>
          <span><b>02</b> Extract insight with AI</span>
          <span><b>03</b> Keep your work in motion</span>
        </div>
      </section>
      <section className="auth-card">
        <span className="eyebrow">Your workspace</span>
        <h2>{verificationStep ? 'Confirm your email' : isRegister ? 'Create your account' : 'Welcome back'}</h2>
        <p className="form-lede">{verificationStep ? 'Enter the code from your inbox to activate your workspace.' : isRegister ? 'Start building a smarter document library.' : 'Sign in to continue where you left off.'}</p>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      <form onSubmit={handleSubmit}>
        {!verificationStep && isRegister && (
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        {!verificationStep && <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}
        {!verificationStep && <input type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength="8" autoComplete={isRegister ? 'new-password' : 'current-password'} required />}
        {verificationStep && <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="Six-digit code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" required />}
        <button className="primary-button" type="submit">{verificationStep ? 'Confirm email' : isRegister ? 'Create account' : 'Sign in'} <span>-&gt;</span></button>
      </form>
      {devCode && <p className="dev-code">Local code: <strong>{devCode}</strong></p>}
      {verificationStep ? <button className="text-button" onClick={resendCode}>Resend code</button> : <p onClick={switchMode} className="toggle">{isRegister ? 'Already have an account? Sign in' : 'Need an account? Create one'}</p>}
      </section>
    </div>
  );
}