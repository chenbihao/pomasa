import { useTranslation } from 'react-i18next'
import Button from './Button'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const toggle = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(next)
    localStorage.setItem('pomasa-dashboard-lang', next)
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle}>
      {i18n.language === 'en' ? '中文' : 'EN'}
    </Button>
  )
}
