'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Eye, X, Loader2, AlertCircle, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CertificateFormData } from '@/lib/certificate-store'
import type { PDFSignatureData } from '@/components/pdf/pdf-utils'

interface PDFPreviewButtonProps {
  certificateId: string
  certificateNumber: string
}

export function PDFPreviewButton({ certificateId, certificateNumber }: PDFPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [certificateData, setCertificateData] = useState<CertificateFormData | null>(null)
  const [signatureData, setSignatureData] = useState<PDFSignatureData | undefined>(undefined)
  const [mounted, setMounted] = useState(false)

  // For SSR safety - only render portal after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Cleanup blob URL on unmount or close
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  // Fetch certificate data
  const fetchCertificateData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/certificates/${certificateId}/pdf-data`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch certificate data')
      }

      const data = await response.json()
      const { signatures, ...certData } = data
      setSignatureData(signatures)
      setCertificateData(certData)
    } catch (err) {
      console.error('Error fetching certificate:', err)
      setError(err instanceof Error ? err.message : 'Failed to load certificate')
    } finally {
      setIsLoading(false)
    }
  }, [certificateId])

  // Generate PDF from certificate data
  const generatePDF = useCallback(async () => {
    if (!certificateData) return

    try {
      setIsGenerating(true)
      setError(null)

      // Revoke old URL if exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
      }

      // Dynamic import of PDF generation
      const { generatePDFWithOptimalSpacing } = await import('@/components/pdf/pdf-two-pass')
      const result = await generatePDFWithOptimalSpacing(certificateData, signatureData)

      console.log(`PDF generated: ${result.pageCount} pages, multiplier: ${result.multiplier.toFixed(2)}`)

      const url = URL.createObjectURL(result.blob)
      setPdfUrl(url)
    } catch (err) {
      console.error('Error generating PDF:', err)
      setError('Failed to generate PDF preview')
    } finally {
      setIsGenerating(false)
    }
  }, [certificateData, signatureData, pdfUrl])

  // Download PDF
  const handleDownload = useCallback(async () => {
    if (!certificateData) return

    try {
      setIsGenerating(true)

      const { generatePDFWithOptimalSpacing } = await import('@/components/pdf/pdf-two-pass')
      const result = await generatePDFWithOptimalSpacing(certificateData, signatureData)

      const fileName = `${certificateNumber.replace(/\//g, '-')}-PREVIEW.pdf`
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      setError('Failed to download PDF')
    } finally {
      setIsGenerating(false)
    }
  }, [certificateData, signatureData, certificateNumber])

  // Handle modal open
  const handleOpen = useCallback(() => {
    setIsOpen(true)
    // Reset state when opening
    setError(null)
    setCertificateData(null)
    setPdfUrl(null)
  }, [])

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsOpen(false)
    // Cleanup
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }
    setCertificateData(null)
    setError(null)
  }, [pdfUrl])

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && !certificateData && !isLoading) {
      fetchCertificateData()
    }
  }, [isOpen, certificateData, isLoading, fetchCertificateData])

  // Generate PDF when data is loaded
  useEffect(() => {
    if (isOpen && certificateData && !pdfUrl && !isGenerating) {
      generatePDF()
    }
  }, [isOpen, certificateData, pdfUrl, isGenerating, generatePDF])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  return (
    <>
      {/* Preview Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700"
      >
        <Eye className="h-4 w-4" />
        Preview PDF
      </Button>

      {/* Modal Overlay */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/80">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">
                Certificate Preview: {certificateNumber}
              </h2>
              {isGenerating && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={generatePDF}
                disabled={isGenerating || !certificateData}
                title="Refresh preview"
              >
                <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isGenerating || !certificateData}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Loading certificate data...</p>
              </div>
            ) : error && !pdfUrl ? (
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Certificate</h3>
                <p className="text-sm text-gray-500 mb-4">{error}</p>
                <Button onClick={fetchCertificateData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : isGenerating || (!pdfUrl && certificateData) ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Generating PDF preview...</p>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl"
                title="Certificate Preview"
              />
            ) : (
              <div className="text-white text-center">
                <p>No preview available</p>
              </div>
            )}
          </div>

          {/* Error toast at bottom */}
          {error && pdfUrl && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
