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
        setNotice(res.data.devVerificationCode
          ? 'Email delivery is not configured. Use the development code shown below.'
          : `A verification email was sent to ${email}.`);
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
      setNotice(res.data.devVerificationCode
        ? 'Email delivery is not configured. Use the new development code below.'
        : 'A new verification email was sent.');
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
        <span className="eyebrow">Environmental sample operations</span>
        <h1>Keep every sample<br /><em>traceable.</em></h1>
        <p>Bring field sheets, custody records, and laboratory results into one evidence desk built for small environmental testing teams.</p>
        <div className="signal-list">
          <span><b>01</b> Link records to sample IDs</span>
          <span><b>02</b> Spot missing custody or results</span>
          <span><b>03</b> Review answers against source records</span>
        </div>
      </section>
      <section className="auth-card">
        <span className="eyebrow">Your workspace</span>
        <h2>{verificationStep ? 'Confirm your email' : isRegister ? 'Create your account' : 'Welcome back'}</h2>
        <p className="form-lede">{verificationStep ? 'Enter the six-digit verification code to activate your workspace.' : isRegister ? 'Create a private evidence desk for your team.' : 'Sign in to continue your sample review.'}</p>
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
      {devCode && <p className="dev-code"><strong>Development code (no email sent)</strong><br />{devCode}</p>}
      {verificationStep ? <button className="text-button" type="button" onClick={resendCode}>Resend code</button> : <button className="toggle auth-mode-toggle" type="button" onClick={switchMode}>{isRegister ? 'Already have an account? Sign in' : 'Need an account? Create one'}</button>}
      </section>
    </div>
  );
}