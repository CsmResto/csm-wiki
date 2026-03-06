import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { defaultLocale } from '@/lib/i18n/locales'

export default function IndexPage() {
  const router = useRouter()
  const target = `/${defaultLocale}`

  useEffect(() => {
    router.replace(target)
  }, [router, target])

  return (
    <>
      <Head>
        <meta httpEquiv="refresh" content={`0;url=${target}`} />
      </Head>
    </>
  )
}