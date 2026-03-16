import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import '../styles/globals.scss'

export default function App({ Component, pageProps }: AppProps) {
  const { basePath } = useRouter()

  return (
    <>
      <Head>
        <link rel="icon" href={`${basePath}/favicon.ico`} />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
