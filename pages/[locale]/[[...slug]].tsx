import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ImgHTMLAttributes, ReactNode } from 'react'
import parse, { DOMNode, HTMLReactParserOptions, domToReact } from 'html-react-parser'
import Zoom from 'react-medium-image-zoom'
import { GalleryZoomImage } from '@/components/GalleryZoom'
import SearchBox, { SearchText } from '@/components/SearchBox'
import { isLocale, Locale, locales } from '@/lib/i18n/locales'
import {
  getAllWikiRouteSlugs,
  getMarkdownData,
  getWikiDirectoryData,
  getWikiTree,
  isDirectorySlug,
  MarkdownData,
  WikiDirectoryData,
  WikiTreeNode,
} from '@/lib/markdown'
import LocaleSwitcher from '@/components/LocaleSwitcher'

type BreadcrumbItem = {
  slug: string
  label: string
}

type PageProps =
  | {
      kind: 'directory'
      locale: Locale
      directory: WikiDirectoryData
      indexPage?: MarkdownData | null
      breadcrumbs: BreadcrumbItem[]
      tree: WikiTreeNode
    }
  | {
      kind: 'page'
      locale: Locale
      page: MarkdownData
      breadcrumbs: BreadcrumbItem[]
      tree: WikiTreeNode
    }

type UiText = {
  rootTitle: string
  homeDescription: string
  copyLabel: string
  copiedLabel: string
  copyFailedLabel: string
  themeLightLabel: string
  themeDarkLabel: string
  exportPdfLabel: string
  search: SearchText
}

const uiTextByLocale: Record<Locale, UiText> = {
  ru: {
    rootTitle: 'CSM Wiki',
    homeDescription: 'База знаний системы COSMOS',
    copyLabel: 'Копировать',
    copiedLabel: 'Скопировано',
    copyFailedLabel: 'Ошибка',
    themeLightLabel: 'Светлая',
    themeDarkLabel: 'Темная',
    exportPdfLabel: 'Печать → PDF',
    search: {
      openLabel: 'Поиск',
      label: 'Поиск',
      placeholder: 'Искать по вики',
      loading: 'Загружаю индекс…',
      empty: 'Введите минимум 2 символа',
      noResults: 'Ничего не найдено',
      error: 'Не удалось загрузить поиск',
      clearLabel: 'Очистить',
      closeLabel: 'Закрыть',
    },
  },
  en: {
    rootTitle: 'CSM Wiki',
    homeDescription: 'COSMOS system knowlegde base',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    copyFailedLabel: 'Failed',
    themeLightLabel: 'Light',
    themeDarkLabel: 'Dark',
    exportPdfLabel: 'Print / PDF',
    search: {
      openLabel: 'Search',
      label: 'Search',
      placeholder: 'Search the wiki',
      loading: 'Loading index…',
      empty: 'Type at least 2 characters',
      noResults: 'No results',
      error: 'Search is unavailable',
      clearLabel: 'Clear',
      closeLabel: 'Close',
    },
  },
}

function buildWikiHref(locale: Locale, slug: string): string {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  return normalizedSlug ? `/${locale}/${normalizedSlug}` : `/${locale}`
}

const ICONS_BASE_PATH = '/assets/icons'
const INFO_ICON_DEFAULTS: Record<string, string> = {
  note: 'info',
  tip: 'tip',
  warning: 'warning',
}

function resolveIconPath(raw: string, basePath: string): string {
  const trimmed = raw.trim()

  if (trimmed.startsWith('http')) {
    return trimmed
  }

  const normalizedBase = basePath?.replace(/\/+$/g, '') ?? ''
  if (trimmed.startsWith('/')) {
    return `${normalizedBase}${trimmed}`
  }

  return `${normalizedBase}/${trimmed}`
}

function renderIcon(icon: string | null, basePath: string, classBase: string): ReactNode {
  if (!icon) {
    return null
  }

  const trimmed = icon.trim()
  if (!trimmed) {
    return null
  }

  const isNonAscii = /[^\x00-\x7F]/.test(trimmed)
  const isExplicitPath = trimmed.startsWith('/') || trimmed.startsWith('http') || trimmed.includes('/')
  const isFileLike = trimmed.includes('.')
  const isSimpleName = /^[a-z0-9_-]+$/i.test(trimmed)

  if (!isNonAscii && (isExplicitPath || isFileLike || isSimpleName)) {
    const iconPath = isSimpleName ? `${ICONS_BASE_PATH}/${trimmed}.svg` : trimmed
    const resolvedPath = resolveIconPath(iconPath, basePath)
    return (
      <span
        className={`${classBase} ${classBase}--image`}
        aria-hidden="true"
        style={{ '--wiki-icon-url': `url("${resolvedPath}")` } as CSSProperties}
      />
    )
  }

  return (
    <span className={classBase} aria-hidden="true">
      {icon}
    </span>
  )
}

function buildDirectoryBreadcrumbs(locale: Locale, slug: string): BreadcrumbItem[] {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  if (!normalizedSlug) {
    return []
  }

  const segments = normalizedSlug.split('/').filter(Boolean)
  return segments.map((_, index) => {
    const itemSlug = segments.slice(0, index + 1).join('/')
    const directory = getWikiDirectoryData(locale, itemSlug)

    return {
      slug: itemSlug,
      label: directory?.name ?? segments[index],
    }
  })
}

function buildPageBreadcrumbs(locale: Locale, page: MarkdownData): BreadcrumbItem[] {
  const segments = page.slug.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  for (let index = 0; index < segments.length - 1; index += 1) {
    const directorySlug = segments.slice(0, index + 1).join('/')
    const directory = getWikiDirectoryData(locale, directorySlug)

    breadcrumbs.push({
      slug: directorySlug,
      label: directory?.name ?? segments[index],
    })
  }

  breadcrumbs.push({
    slug: page.slug,
    label: page.title,
  })

  return breadcrumbs
}

function buildOpenSlugs(slug: string, kind: PageProps['kind']): Set<string> {
  const normalized = slug.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    return new Set()
  }

  const segments = normalized.split('/').filter(Boolean)
  const limit = kind === 'page' ? Math.max(segments.length - 1, 0) : segments.length
  const open = new Set<string>()

  for (let index = 0; index < limit; index += 1) {
    const segmentSlug = segments.slice(0, index + 1).join('/')
    if (segmentSlug) {
      open.add(segmentSlug)
    }
  }

  return open
}

function buildSlugPath(slug: string): string[] {
  const normalized = slug.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    return []
  }

  const segments = normalized.split('/').filter(Boolean)
  const path: string[] = []
  for (let index = 0; index < segments.length; index += 1) {
    path.push(segments.slice(0, index + 1).join('/'))
  }
  return path
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}

function hexToRgba(value: string, alpha: number): string | null {
  if (!isHexColor(value)) {
    return null
  }

  const normalized = value.length === 4
    ? `#${value
        .slice(1)
        .split('')
        .map((char) => `${char}${char}`)
        .join('')}`
    : value

  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function renderMarkdown(contentHtml: string, basePath: string, disableImageZoom = false) {
  const galleryCache = new WeakMap<
    DOMNode,
    {
      images: ImgHTMLAttributes<HTMLImageElement>[]
      indexMap: WeakMap<DOMNode, number>
    }
  >()

  const assetPrefix = basePath
    ? basePath.endsWith('/') ? basePath : `${basePath}/`
    : ''

  const resolveImageSrc = (raw: string): string => {
    if (!raw) return ''
    if (/^(https?:)?\/\//.test(raw)) return raw
    if (/^(data:|mailto:|tel:|#)/.test(raw)) return raw
    if (!assetPrefix || assetPrefix === '/') return raw
    if (raw.startsWith(assetPrefix)) return raw
    if (raw.startsWith('/')) return `${assetPrefix}${raw.replace(/^\/+/, '')}`
    return `${assetPrefix}${raw}`
  }

  const isGifImageSrc = (src: string | undefined): boolean => {
    if (!src) {
      return false
    }

    if (/^data:image\/gif(?:;|,)/i.test(src)) {
      return true
    }

    return /\.gif(?:[?#].*)?$/i.test(src)
  }

  const buildImgProps = (attribs: Record<string, string> | undefined) => {
    const safeAttribs = attribs ?? {}
    const imgProps: ImgHTMLAttributes<HTMLImageElement> = {
      src: resolveImageSrc(safeAttribs.src ?? ''),
      alt: safeAttribs.alt ?? '',
    }

    if (safeAttribs.title) imgProps.title = safeAttribs.title
    if (safeAttribs.width) imgProps.width = Number(safeAttribs.width)
    if (safeAttribs.height) imgProps.height = Number(safeAttribs.height)
    if (safeAttribs.loading) imgProps.loading = safeAttribs.loading as ImgHTMLAttributes<HTMLImageElement>['loading']
    if (safeAttribs.decoding) imgProps.decoding = safeAttribs.decoding as ImgHTMLAttributes<HTMLImageElement>['decoding']
    if (safeAttribs.sizes) imgProps.sizes = safeAttribs.sizes
    if (safeAttribs.srcset) imgProps.srcSet = safeAttribs.srcset
    if (safeAttribs.referrerpolicy) {
      imgProps.referrerPolicy = safeAttribs.referrerpolicy as ImgHTMLAttributes<HTMLImageElement>['referrerPolicy']
    }
    if (safeAttribs.class) imgProps.className = safeAttribs.class

    return imgProps
  }

  const findGalleryNode = (node: DOMNode) => {
    let current = (node as DOMNode & { parent?: DOMNode }).parent
    while (current) {
      if (current.type === 'tag') {
        const element = current as { name?: string; attribs?: Record<string, string> }
        const className = element.attribs?.class ?? ''
        if (element.name === 'div' && className.split(' ').includes('wiki-gallery')) {
          return current
        }
      }
      current = (current as DOMNode & { parent?: DOMNode }).parent
    }
    return null
  }

  const buildGalleryContext = (galleryNode: DOMNode) => {
    const cached = galleryCache.get(galleryNode)
    if (cached) {
      return cached
    }

    const images: ImgHTMLAttributes<HTMLImageElement>[] = []
    const indexMap = new WeakMap<DOMNode, number>()

    const walk = (node: DOMNode) => {
      if (node.type === 'tag') {
        const element = node as { name?: string; attribs?: Record<string, string>; children?: DOMNode[] }
        if (element.name === 'img') {
          indexMap.set(node, images.length)
          images.push(buildImgProps(element.attribs))
        }
        if (element.children?.length) {
          element.children.forEach(walk)
        }
      }
    }

    walk(galleryNode)
    const context = { images, indexMap }
    galleryCache.set(galleryNode, context)
    return context
  }

  const getGalleryContext = (node: DOMNode) => {
    const galleryNode = findGalleryNode(node)
    if (!galleryNode) {
      return null
    }

    const { images, indexMap } = buildGalleryContext(galleryNode)
    const index = indexMap.get(node)
    if (index === undefined) {
      return null
    }

    return { images, index }
  }

  const getMeaningfulChildren = (
    children: Array<{ type: string; name?: string; attribs?: Record<string, string>; data?: string }>
  ) =>
    children.filter((child) => {
      if (child.type === 'text') {
        return Boolean(child.data?.trim())
      }
      return true
    })

  const options: HTMLReactParserOptions = {
    replace: (domNode: DOMNode) => {
      if (domNode.type !== 'tag') {
        return undefined
      }

      const element = domNode as { name?: string; attribs?: Record<string, string> }
      if (element.name === 'div') {
        const className = element.attribs?.class ?? ''
        if (className.split(' ').includes('wiki-info')) {
          const infoIcon = element.attribs?.['data-info-icon']
          const infoColor = element.attribs?.['data-info-color']
          const infoType = element.attribs?.['data-info-type']
          const hasIcon = element.attribs?.['data-info-has-icon'] === 'true'
          const style: CSSProperties & Record<string, string> = {}

          if (infoColor && isHexColor(infoColor)) {
            style['--info-color'] = infoColor
            style['--info-border-color'] = hexToRgba(infoColor, 0.3) ?? infoColor
            style['--info-bg-color'] = hexToRgba(infoColor, 0.08) ?? infoColor
          }

          if (hasIcon && infoIcon) {
            const trimmed = infoIcon.trim()
            if (trimmed) {
              const isNonAscii = /[^\x00-\x7F]/.test(trimmed)
              const isExplicitPath = trimmed.startsWith('/') || trimmed.startsWith('http') || trimmed.includes('/')
              const isFileLike = trimmed.includes('.')
              const isSimpleName = /^[a-z0-9_-]+$/i.test(trimmed)

              if (!isNonAscii && (isExplicitPath || isFileLike || isSimpleName)) {
                const iconPath = isSimpleName ? `${ICONS_BASE_PATH}/${trimmed}.svg` : trimmed
                const resolvedPath = resolveIconPath(iconPath, basePath)
                style['--info-icon-url'] = `url("${resolvedPath}")`
              }
            }
          } else if (hasIcon) {
            const fallbackName = infoType ? INFO_ICON_DEFAULTS[infoType] : undefined
            if (fallbackName) {
              const iconPath = `${ICONS_BASE_PATH}/${fallbackName}.svg`
              const resolvedPath = resolveIconPath(iconPath, basePath)
              style['--info-icon-url'] = `url("${resolvedPath}")`
            }
          }

          return (
            <div
              className={className}
              data-info-type={infoType}
              data-info-icon={infoIcon}
              data-info-color={infoColor}
              data-info-has-icon={hasIcon ? 'true' : undefined}
              style={style}
            >
              {domToReact(
                (domNode as unknown as { children?: DOMNode[] }).children ?? [],
                options
              )}
            </div>
          )
        }
      }

      if (element.name === 'p') {
        const paragraph = domNode as unknown as {
          children?: Array<{ type: string; name?: string; attribs?: Record<string, string>; data?: string }>
        }
        const children = paragraph.children ?? []
        const meaningfulChildren = getMeaningfulChildren(children)

        if (meaningfulChildren.length === 1 && meaningfulChildren[0]?.type === 'tag' && meaningfulChildren[0].name === 'img') {
          const imgChild = meaningfulChildren[0]
          const imgProps = buildImgProps(imgChild.attribs)
          const gallery = getGalleryContext(imgChild as unknown as DOMNode)
          const shouldUseCustomZoom = isGifImageSrc(typeof imgProps.src === 'string' ? imgProps.src : undefined)

          if (disableImageZoom) {
            return <div className="wiki-image"><img {...imgProps} /></div>
          }

          const zoomedImage = gallery ? (
            <GalleryZoomImage images={gallery.images} index={gallery.index} imgProps={imgProps} disableZoom={disableImageZoom} />
          ) : shouldUseCustomZoom ? (
            <GalleryZoomImage images={[imgProps]} index={0} imgProps={imgProps} disableZoom={disableImageZoom} />
          ) : (
            <Zoom>
              <img {...imgProps} />
            </Zoom>
          )

          return <div className="wiki-image">{zoomedImage}</div>
        }
      }

      if (element.name !== 'img') {
        return undefined
      }

      const parent = (domNode as unknown as { parent?: { name?: string; children?: Array<{ type: string; data?: string }> } })
        .parent
      if (parent?.name === 'p') {
        const meaningful = getMeaningfulChildren((parent.children ?? []) as Array<{ type: string; data?: string }>)
        if (meaningful.length > 1) {
          const imgProps = buildImgProps(element.attribs)
          return <img {...imgProps} />
        }
      }

      const imgProps = buildImgProps(element.attribs)
      const gallery = getGalleryContext(domNode)
      const shouldUseCustomZoom = isGifImageSrc(typeof imgProps.src === 'string' ? imgProps.src : undefined)

      if (gallery) {
        return <GalleryZoomImage images={gallery.images} index={gallery.index} imgProps={imgProps} disableZoom={disableImageZoom} />
      }

      if (shouldUseCustomZoom) {
        return <GalleryZoomImage images={[imgProps]} index={0} imgProps={imgProps} disableZoom={disableImageZoom} />
      }

      if (disableImageZoom) {
        return <img {...imgProps} />
      }

      return (
        <Zoom>
          <img {...imgProps} />
        </Zoom>
      )
    },
  }

  return parse(contentHtml, options)
}

export default function WikiPage(props: PageProps) {
  const { basePath } = useRouter()
  const [assetPrefix, setAssetPrefix] = useState(basePath ? `${basePath}/` : '/')
  const text = uiTextByLocale[props.locale]
  const currentSlug = props.kind === 'directory' ? props.directory.slug : props.page.slug
  const breadcrumbs = props.breadcrumbs
  const tree = props.tree
  const markdownContentRef = useRef<HTMLDivElement | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isPrintMode, setIsPrintMode] = useState(false)
  const printTitleRef = useRef<string | null>(null)
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(() => buildOpenSlugs(currentSlug, props.kind))
  const indexPage = props.kind === 'directory' ? props.indexPage ?? null : null
  const contentHtml = props.kind === 'page' ? props.page.contentHtml : indexPage?.contentHtml
  const markdownContent = useMemo(() => {
    if (!contentHtml) {
      return null
    }
    return renderMarkdown(contentHtml, assetPrefix, isPrintMode)
  }, [contentHtml, assetPrefix, isPrintMode])

  useEffect(() => {
    setOpenSlugs(buildOpenSlugs(currentSlug, props.kind))
  }, [currentSlug, props.kind])

  const toggleDirectory = (slug: string) => {
    setOpenSlugs((prev) => {
      if (prev.has(slug)) {
        const next = new Set(prev)
        next.forEach((openSlug) => {
          if (openSlug === slug || openSlug.startsWith(`${slug}/`)) {
            next.delete(openSlug)
          }
        })
        return next
      }

      return new Set(buildSlugPath(slug))
    })
  }

  useEffect(() => {
    const attrTheme = document.documentElement.getAttribute('data-theme')
    if (attrTheme === 'light' || attrTheme === 'dark') {
      setTheme(attrTheme)
      return
    }
    const stored = window.localStorage.getItem('wiki-theme')
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const initialTheme = stored === 'light' || stored === 'dark' ? stored : prefersLight ? 'light' : 'dark'
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  useEffect(() => {
    if (basePath) {
      setAssetPrefix(`${basePath}/`)
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    const segments = window.location.pathname.split('/').filter(Boolean)
    if (segments.length > 1 && segments[1] === props.locale) {
      setAssetPrefix(`/${segments[0]}/`)
      return
    }
    if (segments.length > 0 && segments[0] === props.locale) {
      setAssetPrefix('/')
      return
    }
    setAssetPrefix('/')
  }, [basePath, props.locale])

  const applyTheme = (nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    window.localStorage.setItem('wiki-theme', nextTheme)
  }

  const lastScrollYRef = useRef(0)
  const headerHiddenRef = useRef(false)
  const scrollTargetRef = useRef<HTMLElement | Document | Window | null>(null)

  useEffect(() => {
    headerHiddenRef.current = isHeaderHidden
  }, [isHeaderHidden])

  useEffect(() => {
    const getScrollTop = () => {
      const target = scrollTargetRef.current
      if (target === window) {
        return window.scrollY ?? 0
      }
      if (target === document) {
        return document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
      }
      if (target && 'scrollTop' in target) {
        return (target as HTMLElement).scrollTop ?? 0
      }
      return document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
    }

    lastScrollYRef.current = getScrollTop()
    let ticking = false

    const update = () => {
      const currentY = getScrollTop()
      const delta = currentY - lastScrollYRef.current
      const nextHidden = currentY > 80 && delta > 6
      const shouldShow = delta < -6 || currentY < 40

      if (nextHidden && !headerHiddenRef.current) {
        headerHiddenRef.current = true
        setIsHeaderHidden(true)
      } else if (shouldShow && headerHiddenRef.current) {
        headerHiddenRef.current = false
        setIsHeaderHidden(false)
      }

      lastScrollYRef.current = currentY
      ticking = false
    }

    const onScroll = (event?: Event) => {
      if (!scrollTargetRef.current) {
        const target = event?.target
        if (target instanceof HTMLElement) {
          scrollTargetRef.current = target
        } else if (target === document) {
          scrollTargetRef.current = document
        } else {
          scrollTargetRef.current = window
        }
      }
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(update)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [])

  const renderNavList = (node: WikiTreeNode, level: number, onNavigate?: () => void) => {
    const hasChildren = node.directories.length > 0 || node.pages.length > 0
    if (!hasChildren) {
      return null
    }

    return (
      <ul className={`wiki-nav-list ${level === 0 ? 'is-root' : ''}`}>
        {node.directories.map((directory) => {
          const isOpen = openSlugs.has(directory.slug)
          const isActive = currentSlug === directory.slug
          const canToggle = directory.directories.length > 0 || directory.pages.length > 0
          return (
            <li key={directory.slug} className={`wiki-nav-item ${isActive ? 'is-active' : ''}`}>
              <div className="wiki-nav-row">
                <Link href={buildWikiHref(props.locale, directory.slug)} className="wiki-nav-link" onClick={onNavigate}>
                  {renderIcon(directory.icon, basePath, 'wiki-nav-icon')}
                  {directory.name}
                </Link>
                {canToggle && (
                  <button
                    type="button"
                    className={`wiki-nav-toggle ${isOpen ? 'is-open' : ''}`}
                    aria-label={`Toggle ${directory.name}`}
                    aria-expanded={isOpen}
                    onClick={() => toggleDirectory(directory.slug)}
                  />
                )}
              </div>
              {isOpen && renderNavList(directory, level + 1, onNavigate)}
            </li>
          )
        })}
        {node.pages.map((page) => {
          const isActive = currentSlug === page.slug
          return (
            <li key={page.slug} className={`wiki-nav-item ${isActive ? 'is-active' : ''}`}>
              <Link href={buildWikiHref(props.locale, page.slug)} className="wiki-nav-link" onClick={onNavigate}>
                {renderIcon(page.icon ?? null, basePath, 'wiki-nav-icon')}
                {page.title}
              </Link>
            </li>
          )
        })}
      </ul>
    )
  }

  useEffect(() => {
    if (props.kind !== 'page') {
      return
    }

    const root = markdownContentRef.current
    if (!root) {
      return
    }

    const buttons = root.querySelectorAll<HTMLButtonElement>('[data-copy-code]')
    buttons.forEach((button) => {
      button.setAttribute('aria-label', text.copyLabel)
    })

    const findAnchorTarget = (rawId: string): HTMLElement | null => {
      if (!rawId) {
        return null
      }
      const direct = document.getElementById(rawId)
      if (direct) {
        return direct
      }
      return document.getElementById(`user-content-${rawId}`)
    }

    const scrollToAnchor = (rawId: string) => {
      const target = findAnchorTarget(rawId)
      if (!target) {
        return false
      }
      target.scrollIntoView({ block: 'start' })
      history.replaceState(null, '', `#${encodeURIComponent(rawId)}`)
      return true
    }

    const scrollToAnchorWithRetry = (rawId: string) => {
      if (!rawId) {
        return
      }
      let attempts = 0
      const maxAttempts = 12
      const tick = () => {
        if (scrollToAnchor(rawId)) {
          return
        }
        attempts += 1
        if (attempts < maxAttempts) {
          window.requestAnimationFrame(tick)
        }
      }
      tick()
    }

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const headingLink = target?.closest<HTMLAnchorElement>('h1 > a, h2 > a, h3 > a, h4 > a, h5 > a, h6 > a, .heading-anchor')
      if (headingLink) {
        event.preventDefault()
        const url = `${window.location.origin}${window.location.pathname}${headingLink.getAttribute('href') ?? ''}`
        try {
          await navigator.clipboard.writeText(url)
        } catch {}
        return
      }

      const anchorLink = target?.closest<HTMLAnchorElement>('a[href^="#"]')
      if (anchorLink) {
        const href = anchorLink.getAttribute('href') ?? ''
        const id = decodeURIComponent(href.slice(1))
        if (id) {
          event.preventDefault()
          scrollToAnchorWithRetry(id)
          return
        }
      }

      const button = target?.closest<HTMLButtonElement>('[data-copy-code]')
      if (!button) {
        return
      }

      const codeNode = button.closest('.code-block')?.querySelector('pre code')
      const codeText = codeNode?.textContent ?? ''
      if (!codeText) {
        return
      }

      try {
        await navigator.clipboard.writeText(codeText)
        button.setAttribute('aria-label', text.copiedLabel)
        button.classList.add('is-copied')

        window.setTimeout(() => {
          button.setAttribute('aria-label', text.copyLabel)
          button.classList.remove('is-copied')
        }, 1400)
      } catch {
        button.setAttribute('aria-label', text.copyFailedLabel)
        button.classList.add('is-copy-failed')

        window.setTimeout(() => {
          button.setAttribute('aria-label', text.copyLabel)
          button.classList.remove('is-copy-failed')
        }, 1700)
      }
    }

    root.addEventListener('click', onClick)
    const handleHashChange = () => {
      const rawId = decodeURIComponent(window.location.hash.slice(1))
      if (rawId) {
        scrollToAnchorWithRetry(rawId)
      }
    }
    if (window.location.hash) {
      window.setTimeout(handleHashChange, 0)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      root.removeEventListener('click', onClick)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [props.kind, text.copyFailedLabel, text.copiedLabel, text.copyLabel])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const header = document.querySelector<HTMLElement>('.wiki-toolbar--sticky')
    if (!header) {
      return
    }
    const updateOffset = () => {
      const height = Math.max(0, Math.round(header.getBoundingClientRect().height))
      document.documentElement.style.setProperty('--wiki-toolbar-offset', `${height}px`)
    }
    updateOffset()
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateOffset)
      resizeObserver.observe(header)
    }
    window.addEventListener('resize', updateOffset)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateOffset)
    }
  }, [])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const restoreAfterPrint = () => {
      setIsPrintMode(false)
      if (printTitleRef.current !== null) {
        document.title = printTitleRef.current
        printTitleRef.current = null
      }
      setIsExportingPdf(false)
    }

    const handleAfterPrint = () => {
      restoreAfterPrint()
    }

    const handleBeforePrint = () => {
      setIsPrintMode(true)
    }

    const mediaQuery = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsPrintMode(true)
        return
      }
      if (!event.matches) {
        restoreAfterPrint()
      }
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    mediaQuery?.addEventListener?.('change', handleMediaQueryChange)

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
      mediaQuery?.removeEventListener?.('change', handleMediaQueryChange)
    }
  }, [])

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const handleExportPdf = () => {
    if (props.kind !== 'page') {
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    if (isExportingPdf) {
      return
    }
    closeMobileMenu()

    const printTitle = props.page.title
      .trim()
      .replace(/[\\/?%*:|"<>]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
    setIsExportingPdf(true)
    setIsPrintMode(true)
    if (printTitleRef.current === null) {
      printTitleRef.current = document.title
    }
    document.title = printTitle || 'csm-wiki'
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print()
      })
    })
  }
  const canExportPdf = props.kind === 'page'

  if (props.kind === 'directory') {
    const { directory, locale } = props
    const isRootDirectory = directory.slug === ''
    const directoryTitle = indexPage?.title ?? (isRootDirectory ? text.rootTitle : directory.name)
    const directoryDescription = indexPage?.description ?? directory.description ?? null

    return (
      <>
        <Head>
          <title>{directoryTitle} | CSM Wiki</title>
          <meta name="description" content={directoryDescription ?? text.homeDescription} />
        </Head>
        <main className="wiki-shell">
          <aside className="wiki-sidebar">
            <div className="wiki-sidebar__header">
              <Link href={buildWikiHref(locale, '')} className="wiki-sidebar__title" aria-label={text.rootTitle}>
                <span className="wiki-sidebar__logo" aria-hidden="true">
                  <img
                    className="wiki-logo__full"
                    src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                    alt=""
                  />
                  <img
                    className="wiki-logo__compact"
                    src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                    alt=""
                  />
                </span>
              </Link>
            </div>
            <div className="wiki-sidebar__nav">{renderNavList(tree, 0)}</div>
          </aside>
          <section className="wiki-content">
            <header className={`wiki-toolbar wiki-toolbar--sticky ${isHeaderHidden ? 'is-hidden' : ''}`}>
              {isRootDirectory ? (
                <span />
              ) : (
                <nav className="wiki-breadcrumbs" aria-label="Breadcrumb">
                  <Link href={buildWikiHref(locale, '')} className="wiki-breadcrumb-link">
                    {text.rootTitle}
                  </Link>
                  {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1
                    return (
                      <span key={item.slug} className="wiki-breadcrumb-item">
                        <span className="wiki-breadcrumb-separator">/</span>
                        {isLast ? (
                          <span className="wiki-breadcrumb-current">{item.label}</span>
                        ) : (
                          <Link href={buildWikiHref(locale, item.slug)} className="wiki-breadcrumb-link">
                            {item.label}
                          </Link>
                        )}
                      </span>
                    )
                  })}
                </nav>
              )}
              <div className="wiki-toolbar__controls">
                <SearchBox locale={locale} assetPrefix={assetPrefix} text={text.search} />
                <div className="theme-switcher" role="group" aria-label="Theme switcher">
                  <button
                    type="button"
                    className={`theme-switcher-button${theme === 'light' ? ' is-active' : ''}`}
                    onClick={() => applyTheme('light')}
                    aria-pressed={theme === 'light'}
                    aria-label={text.themeLightLabel}
                  >
                    <span
                      className="theme-switcher-icon theme-switcher-icon--image"
                      style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/sun.svg")` } as CSSProperties}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className={`theme-switcher-button${theme === 'dark' ? ' is-active' : ''}`}
                    onClick={() => applyTheme('dark')}
                    aria-pressed={theme === 'dark'}
                    aria-label={text.themeDarkLabel}
                  >
                    <span
                      className="theme-switcher-icon theme-switcher-icon--image"
                      style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/moon.svg")` } as CSSProperties}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <LocaleSwitcher locale={locale} slug={currentSlug} />
                {canExportPdf && (
                  <button
                    type="button"
                    className="wiki-toolbar__button wiki-toolbar__button--pdf"
                    onClick={handleExportPdf}
                    aria-label={text.exportPdfLabel}
                    aria-busy={isExportingPdf}
                    disabled={isExportingPdf}
                  >
                    <span
                      className="wiki-toolbar__button-icon"
                      style={{ '--pdf-icon-url': `url("${assetPrefix}assets/icons/download.svg")` } as CSSProperties}
                      aria-hidden="true"
                    />
                    <span className="wiki-toolbar__button-label">{text.exportPdfLabel}</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="wiki-mobile-menu-toggle"
                aria-label="Open menu"
                aria-controls="wiki-mobile-menu"
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
                <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
                <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
              </button>
            </header>
            <div className={`wiki-mobile-menu ${isMobileMenuOpen ? 'is-open' : ''}`} id="wiki-mobile-menu">
              <button type="button" className="wiki-mobile-menu__backdrop" onClick={closeMobileMenu} aria-hidden="true" />
              <div className="wiki-mobile-menu__panel" role="dialog" aria-modal="true">
                <div className="wiki-mobile-menu__header">
                  <Link
                    href={buildWikiHref(locale, '')}
                    className="wiki-mobile-menu__logo"
                    aria-label={text.rootTitle}
                    onClick={closeMobileMenu}
                  >
                    <span className="wiki-mobile-menu__logo-image" aria-hidden="true">
                      <img
                        className="wiki-logo__full"
                        src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                        alt=""
                      />
                      <img
                        className="wiki-logo__compact"
                        src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                        alt=""
                      />
                    </span>
                  </Link>
                  <button type="button" className="wiki-mobile-menu__close" onClick={closeMobileMenu} aria-label="Close menu">
                    <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                    <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                  </button>
                </div>
                <div className="wiki-mobile-menu__controls">
                  <div className="theme-switcher" role="group" aria-label="Theme switcher">
                    <button
                      type="button"
                      className={`theme-switcher-button${theme === 'light' ? ' is-active' : ''}`}
                      onClick={() => applyTheme('light')}
                      aria-pressed={theme === 'light'}
                      aria-label={text.themeLightLabel}
                    >
                      <span
                        className="theme-switcher-icon theme-switcher-icon--image"
                        style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/sun.svg")` } as CSSProperties}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className={`theme-switcher-button${theme === 'dark' ? ' is-active' : ''}`}
                      onClick={() => applyTheme('dark')}
                      aria-pressed={theme === 'dark'}
                      aria-label={text.themeDarkLabel}
                    >
                      <span
                        className="theme-switcher-icon theme-switcher-icon--image"
                        style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/moon.svg")` } as CSSProperties}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <LocaleSwitcher locale={locale} slug={currentSlug} />
                  {canExportPdf && (
                    <button
                      type="button"
                      className="wiki-toolbar__button wiki-toolbar__button--pdf"
                      onClick={() => {
                        closeMobileMenu()
                        handleExportPdf()
                      }}
                      aria-label={text.exportPdfLabel}
                      aria-busy={isExportingPdf}
                      disabled={isExportingPdf}
                    >
                      <span
                        className="wiki-toolbar__button-icon"
                        style={{ '--pdf-icon-url': `url("${assetPrefix}assets/icons/download.svg")` } as CSSProperties}
                        aria-hidden="true"
                      />
                      <span className="wiki-toolbar__button-label">{text.exportPdfLabel}</span>
                    </button>
                  )}
                </div>
                <div className="wiki-mobile-menu__search">
                  <SearchBox
                    locale={locale}
                    assetPrefix={assetPrefix}
                    text={text.search}
                    onNavigate={closeMobileMenu}
                    onOpen={closeMobileMenu}
                  />
                </div>
                <nav className="wiki-mobile-menu__nav" aria-label="Site navigation">
                  {renderNavList(tree, 0, closeMobileMenu)}
                </nav>
              </div>
            </div>

            {indexPage ? (
              <article className="wiki-article">
                <h1>{directoryTitle}</h1>
                {directoryDescription && <p className="wiki-subtitle">{directoryDescription}</p>}
                {markdownContent && (
                  <div
                    ref={markdownContentRef}
                    className="wiki-markdown"
                    style={{
                      '--code-copy-icon-url': `url("${assetPrefix}assets/icons/copy.svg")`,
                      '--code-copied-icon-url': `url("${assetPrefix}assets/icons/check.svg")`,
                    } as CSSProperties}
                  >
                    {markdownContent}
                  </div>
                )}
              </article>
            ) : (
              <>
                <h1>{directoryTitle}</h1>
                {directoryDescription && <p className="wiki-subtitle">{directoryDescription}</p>}
              </>
            )}

            {directory.directories.length > 0 && (
              <ul className="wiki-tree-list">
                {directory.directories.map((folder) => (
                  <li key={folder.slug} className="wiki-page-list-item is-folder">
                    <Link href={buildWikiHref(locale, folder.slug)} className="wiki-page-link">
                      <span className="wiki-page-title">
                        {renderIcon(folder.icon ?? null, basePath, 'wiki-page-icon')}
                        {folder.name}
                      </span>
                      {folder.summary && <p className="wiki-page-meta">{folder.summary}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {directory.pages.length > 0 && (
              <ul className="wiki-tree-list">
                {directory.pages.map((page) => (
                  <li key={page.slug} className="wiki-page-list-item is-page">
                    <Link href={buildWikiHref(locale, page.slug)} className="wiki-page-link">
                      <span className="wiki-page-title">
                        {renderIcon(page.icon ?? null, basePath, 'wiki-page-icon')}
                        {page.title}
                      </span>
                      {page.summary && <p className="wiki-page-meta">{page.summary}</p>}
                    </Link>
                  </li>
                ))}
                </ul>
            )}
          </section>
        </main>
      </>
    )
  }

  const { page, locale } = props
  return (
    <>
      <Head>
        <title>{page.title} | CSM Wiki</title>
        {page.description && <meta name="description" content={page.description} />}
      </Head>
      <main className="wiki-shell">
        <aside className="wiki-sidebar">
          <div className="wiki-sidebar__header">
            <Link href={buildWikiHref(locale, '')} className="wiki-sidebar__title" aria-label={text.rootTitle}>
              <span className="wiki-sidebar__logo" aria-hidden="true">
                <img
                  className="wiki-logo__full"
                  src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                  alt=""
                />
                <img
                  className="wiki-logo__compact"
                  src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                  alt=""
                />
              </span>
            </Link>
          </div>
          <div className="wiki-sidebar__nav">{renderNavList(tree, 0)}</div>
        </aside>
        <section className="wiki-content">
          <header className={`wiki-toolbar wiki-toolbar--sticky ${isHeaderHidden ? 'is-hidden' : ''}`}>
            <nav className="wiki-breadcrumbs" aria-label="Breadcrumb">
              <Link href={buildWikiHref(locale, '')} className="wiki-breadcrumb-link">
                {text.rootTitle}
              </Link>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <span key={item.slug} className="wiki-breadcrumb-item">
                    <span className="wiki-breadcrumb-separator">/</span>
                    {isLast ? (
                      <span className="wiki-breadcrumb-current">{item.label}</span>
                    ) : (
                      <Link href={buildWikiHref(locale, item.slug)} className="wiki-breadcrumb-link">
                        {item.label}
                      </Link>
                    )}
                  </span>
                )
                })}
              </nav>
            <div className="wiki-toolbar__controls">
              <SearchBox locale={locale} assetPrefix={assetPrefix} text={text.search} />
              <div className="theme-switcher" role="group" aria-label="Theme switcher">
                <button
                  type="button"
                  className={`theme-switcher-button${theme === 'light' ? ' is-active' : ''}`}
                  onClick={() => applyTheme('light')}
                  aria-pressed={theme === 'light'}
                  aria-label={text.themeLightLabel}
                >
                  <span
                    className="theme-switcher-icon theme-switcher-icon--image"
                    style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/sun.svg")` } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  className={`theme-switcher-button${theme === 'dark' ? ' is-active' : ''}`}
                  onClick={() => applyTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  aria-label={text.themeDarkLabel}
                >
                  <span
                    className="theme-switcher-icon theme-switcher-icon--image"
                    style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/moon.svg")` } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </div>
              <LocaleSwitcher locale={locale} slug={currentSlug} />
              {canExportPdf && (
                <button
                  type="button"
                  className="wiki-toolbar__button wiki-toolbar__button--pdf"
                  onClick={handleExportPdf}
                  aria-label={text.exportPdfLabel}
                  aria-busy={isExportingPdf}
                  disabled={isExportingPdf}
                >
                  <span
                    className="wiki-toolbar__button-icon"
                    style={{ '--pdf-icon-url': `url("${assetPrefix}assets/icons/download.svg")` } as CSSProperties}
                    aria-hidden="true"
                  />
                  <span className="wiki-toolbar__button-label">{text.exportPdfLabel}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              className="wiki-mobile-menu-toggle"
              aria-label="Open menu"
              aria-controls="wiki-mobile-menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
              <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
              <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
            </button>
          </header>
          <div className={`wiki-mobile-menu ${isMobileMenuOpen ? 'is-open' : ''}`} id="wiki-mobile-menu">
            <button type="button" className="wiki-mobile-menu__backdrop" onClick={closeMobileMenu} aria-hidden="true" />
            <div className="wiki-mobile-menu__panel" role="dialog" aria-modal="true">
              <div className="wiki-mobile-menu__header">
                <Link
                  href={buildWikiHref(locale, '')}
                  className="wiki-mobile-menu__logo"
                  aria-label={text.rootTitle}
                  onClick={closeMobileMenu}
                >
                  <span className="wiki-mobile-menu__logo-image" aria-hidden="true">
                    <img
                      className="wiki-logo__full"
                      src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                      alt=""
                    />
                    <img
                      className="wiki-logo__compact"
                      src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                      alt=""
                    />
                  </span>
                </Link>
                <button type="button" className="wiki-mobile-menu__close" onClick={closeMobileMenu} aria-label="Close menu">
                  <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                  <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                </button>
              </div>
              <div className="wiki-mobile-menu__controls">
                <div className="theme-switcher" role="group" aria-label="Theme switcher">
                  <button
                    type="button"
                    className={`theme-switcher-button${theme === 'light' ? ' is-active' : ''}`}
                    onClick={() => applyTheme('light')}
                    aria-pressed={theme === 'light'}
                    aria-label={text.themeLightLabel}
                  >
                    <span
                      className="theme-switcher-icon theme-switcher-icon--image"
                      style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/sun.svg")` } as CSSProperties}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className={`theme-switcher-button${theme === 'dark' ? ' is-active' : ''}`}
                    onClick={() => applyTheme('dark')}
                    aria-pressed={theme === 'dark'}
                    aria-label={text.themeDarkLabel}
                  >
                    <span
                      className="theme-switcher-icon theme-switcher-icon--image"
                      style={{ '--theme-icon-url': `url("${assetPrefix}assets/icons/moon.svg")` } as CSSProperties}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <LocaleSwitcher locale={locale} slug={currentSlug} />
                {canExportPdf && (
                  <button
                    type="button"
                    className="wiki-toolbar__button wiki-toolbar__button--pdf"
                    onClick={() => {
                      closeMobileMenu()
                      handleExportPdf()
                    }}
                    aria-label={text.exportPdfLabel}
                    aria-busy={isExportingPdf}
                    disabled={isExportingPdf}
                  >
                    <span
                      className="wiki-toolbar__button-icon"
                      style={{ '--pdf-icon-url': `url("${assetPrefix}assets/icons/download.svg")` } as CSSProperties}
                      aria-hidden="true"
                    />
                    <span className="wiki-toolbar__button-label">{text.exportPdfLabel}</span>
                  </button>
                )}
              </div>
              <div className="wiki-mobile-menu__search">
                <SearchBox
                  locale={locale}
                  assetPrefix={assetPrefix}
                  text={text.search}
                  onNavigate={closeMobileMenu}
                  onOpen={closeMobileMenu}
                />
              </div>
              <nav className="wiki-mobile-menu__nav" aria-label="Site navigation">
                {renderNavList(tree, 0, closeMobileMenu)}
              </nav>
            </div>
          </div>

          <article ref={articleRef} className="wiki-article">
            <h1>{page.title}</h1>
            {page.description && <p className="wiki-subtitle">{page.description}</p>}
            <div
              ref={markdownContentRef}
              className="wiki-markdown"
              style={{
                '--code-copy-icon-url': `url("${assetPrefix}assets/icons/copy.svg")`,
                '--code-copied-icon-url': `url("${assetPrefix}assets/icons/check.svg")`,
              } as CSSProperties}
            >
              {markdownContent}
            </div>
          </article>
        </section>
      </main>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: Array<{ params: { locale: Locale; slug: string[] } }> = []

  for (const locale of locales) {
    paths.push({ params: { locale, slug: [] } })

    for (const slug of getAllWikiRouteSlugs(locale)) {
      paths.push({ params: { locale, slug: slug.split('/') } })
    }
  }

  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<PageProps, { locale: string; slug?: string[] }> = async ({ params }) => {
  if (!params?.locale || !isLocale(params.locale)) {
    return { notFound: true }
  }

  const locale = params.locale
  const slug = params.slug?.join('/') ?? ''

  if (isDirectorySlug(locale, slug)) {
    const directory = getWikiDirectoryData(locale, slug)
    if (!directory) {
      return { notFound: true }
    }

    const indexSlug = slug ? `${slug}/index` : 'index'
    let indexPage: MarkdownData | null = null
    try {
      indexPage = await getMarkdownData(locale, indexSlug)
    } catch {
      indexPage = null
    }

    return {
      props: {
        kind: 'directory',
        locale,
        directory,
        indexPage,
        breadcrumbs: buildDirectoryBreadcrumbs(locale, slug),
        tree: getWikiTree(locale),
      },
    }
  }

  try {
    const page = await getMarkdownData(locale, slug)
    return {
      props: {
        kind: 'page',
        locale,
        page,
        breadcrumbs: buildPageBreadcrumbs(locale, page),
        tree: getWikiTree(locale),
      },
    }
  } catch {
    return { notFound: true }
  }
}
