'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SignatureModal } from '@/components/signatures'
import type { SignatureData } from '@/types/signatures'
import type { CertificateFormData } from '@/lib/stores/certificate-store'
import type { PDFSignatureData } from '@/components/pdf/pdf-utils'
import {
  Loader2,
  ChevronLeft,
  ShieldCheck,
  MessageSquare,
  Send,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
  Building2,
} from 'lucide-react'

interface CertificateData {
  id: string
  certificateNumber: string
  status: string
  currentRevision: number
  customerName: string | null
  customerAddress: string | null
  uucDescription: string | null
  uucMake: string | null
  uucModel: string | null
  uucSerialNumber: string | null
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  createdBy: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
}

interface RevisionHistoryItem {
  id: string
  type: 'customer_request' | 'hod_response' | 'sent_to_customer' | 'admin_message'
  message: string
  createdAt: string
  userName?: string
  companyName?: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function AuthorizationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const certificateId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [certificate, setCertificate] = useState<CertificateData | null>(null)
  const [formData, setFormData] = useState<CertificateFormData | null>(null)
  const [signatures, setSignatures] = useState<PDFSignatureData | undefined>(undefined)
  const [revisionHistory, setRevisionHistory] = useState<RevisionHistoryItem[]>([])

  // PDF state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Message state
  const [newMessage, setNewMessage] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  // Authorize state
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [authorizeError, setAuthorizeError] = useState<string | null>(null)

  // Fetch certificate data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/authorization/${certificateId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch certificate')
      }

      const data = await response.json()
      setCertificate(data.certificate)
      setFormData(data.formData)
      setSignatures(data.formData.signatures)
      setRevisionHistory(data.revisionHistory)
    } catch (err) {
      console.error('Error fetching certificate:', err)
      setError(err instanceof Error ? err.message : 'Failed to load certificate')
    } finally {
      setIsLoading(false)
    }
  }, [certificateId])

  // Generate PDF
  const generatePDF = useCallback(async () => {
    if (!formData) return

    try {
      setIsGeneratingPdf(true)

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
      }

      const { generatePDFWithOptimalSpacing } = await import('@/components/pdf/pdf-two-pass')
      const result = await generatePDFWithOptimalSpacing(formData, signatures)

      const url = URL.createObjectURL(result.blob)
      setPdfUrl(url)
    } catch (err) {
      console.error('Error generating PDF:', err)
      setError('Failed to generate PDF preview')
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [formData, signatures, pdfUrl])

  // Download PDF
  const handleDownload = useCallback(async () => {
    if (!formData || !certificate) return

    try {
      setIsGeneratingPdf(true)

      const { generatePDFWithOptimalSpacing } = await import('@/components/pdf/pdf-two-pass')
      const result = await generatePDFWithOptimalSpacing(formData, signatures)

      const fileName = `${certificate.certificateNumber.replace(/\//g, '-')}.pdf`
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
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [formData, signatures, certificate])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      setIsSendingMessage(true)

      const response = await fetch(`/api/admin/authorization/${certificateId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      })

      if (response.ok) {
        const data = await response.json()
        setRevisionHistory(prev => [data.event, ...prev])
        setNewMessage('')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Failed to send message')
    } finally {
      setIsSendingMessage(false)
    }
  }

  // Authorize certificate
  const handleAuthorize = async (data: SignatureData) => {
    setIsAuthorizing(true)
    setAuthorizeError(null)

    try {
      const response = await fetch(`/api/admin/authorization/${certificateId}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData: data.signatureImage,
          signerName: data.signerName,
          clientEvidence: data.clientEvidence,
        }),
      })

      if (response.ok) {
        router.push('/admin/authorization')
      } else {
        let errorMessage = 'Failed to authorize certificate'
        try {
          const text = await response.text()
          if (text) {
            const responseData = JSON.parse(text)
            errorMessage = responseData.error || errorMessage
          }
        } catch {
          errorMessage = `Server error (${response.status})`
        }
        setAuthorizeError(errorMessage)
      }
    } catch (err) {
      console.error('Authorization error:', err)
      setAuthorizeError('An error occurred. Please try again.')
    } finally {
      setIsAuthorizing(false)
    }
  }

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Generate PDF when data is loaded
  useEffect(() => {
    if (formData && !pdfUrl && !isGeneratingPdf) {
      generatePDF()
    }
  }, [formData, pdfUrl, isGeneratingPdf, generatePDF])

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-gray-500">Loading certificate...</p>
        </div>
      </div>
    )
  }

  if (error && !certificate) {
    return (
      <div className="h-screen flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Certificate</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => router.push('/admin/authorization')} variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to List
            </Button>
            <Button onClick={fetchData} size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isAuthorized = certificate?.status === 'AUTHORIZED'

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-4 py-2.5 z-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/hta-logo.jpg"
              alt="HTA Instrumentation"
              width={50}
              height={25}
              className="object-contain"
            />
            <div className="h-5 w-px bg-gray-300" />
            <span className="text-sm font-bold text-gray-700">
              Certificate Authorization: {certificate?.certificateNumber}
            </span>
          </div>
        </div>
      </header>

      {/* Certificate Info Banner */}
      <div className="bg-white border-b px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link href="/admin/authorization" className="text-sm font-semibold hover:text-gray-700 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back to Authorization List
          </Link>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{certificate?.customerName || 'N/A'}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Instrument:</span>
              <span className="font-medium">{certificate?.uucDescription || 'N/A'}</span>
            </div>
            {certificate?.uucMake && (
              <>
                <div className="h-4 w-px bg-gray-300" />
                <span className="text-gray-500">{certificate.uucMake} {certificate.uucModel}</span>
              </>
            )}
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Calibration: {formatDate(certificate?.dateOfCalibration || null)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full px-4 py-4 overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* PDF Preview Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col min-h-0">
            {/* Header with controls */}
            <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Certificate Preview
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generatePDF}
                  disabled={isGeneratingPdf}
                  title="Refresh preview"
                  className="h-7 w-7 p-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={isGeneratingPdf} className="h-7 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
              </div>
            </div>

            {/* PDF iframe */}
            {isGeneratingPdf || (!pdfUrl && formData) ? (
              <div className="flex-1 bg-gray-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p>Generating PDF preview...</p>
                </div>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full flex-1 border-0"
                title="Certificate Preview"
              />
            ) : (
              <div className="flex-1 bg-gray-100 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No preview available</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Side Panels */}
          <div className="flex flex-col gap-4 overflow-hidden min-h-0">
            {/* Chat History Panel */}
            <div className="bg-white rounded-lg border shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 text-[13px]">Conversation History</h2>
                  {revisionHistory.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">
                      {revisionHistory.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-3 overflow-y-auto bg-gray-50 flex flex-col-reverse">
                {revisionHistory.length === 0 ? (
                  <div className="text-[12px] text-gray-500 text-center py-4">
                    <p>No messages in this conversation.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {[...revisionHistory].reverse().map((item) => {
                      const isAdminMessage = item.type === 'admin_message'
                      const isCustomerMessage = item.type === 'customer_request'
                      return (
                        <div
                          key={item.id}
                          className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`relative max-w-[85%] px-3 py-2 rounded-lg text-[12px] border ${
                              isAdminMessage
                                ? 'bg-green-50 border-green-200 rounded-br-none'
                                : isCustomerMessage
                                ? 'bg-purple-50 border-purple-200 rounded-bl-none'
                                : item.type === 'hod_response'
                                ? 'bg-orange-50 border-orange-200 rounded-bl-none'
                                : 'bg-blue-50 border-blue-200 rounded-bl-none'
                            }`}
                          >
                            {!isAdminMessage && (
                              <p className={`text-[10px] font-semibold mb-0.5 ${
                                isCustomerMessage
                                  ? 'text-purple-600'
                                  : item.type === 'hod_response'
                                  ? 'text-orange-600'
                                  : 'text-blue-600'
                              }`}>
                                {isCustomerMessage ? 'Customer' : item.type === 'hod_response' ? 'HoD' : 'HTA'}
                                {item.userName && ` • ${item.userName}`}
                              </p>
                            )}
                            {isAdminMessage && (
                              <p className="text-[10px] font-semibold mb-0.5 text-green-600">
                                Admin {item.userName && `• ${item.userName}`}
                              </p>
                            )}
                            <p className="text-gray-700 whitespace-pre-wrap">{item.message}</p>
                            <p className={`text-[9px] mt-1 ${isAdminMessage ? 'text-green-400 text-right' : 'text-gray-400'}`}>
                              {new Date(item.createdAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Message Input */}
              {!isAuthorized && (
                <div className="p-2 border-t bg-gray-50">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 p-2 border border-gray-200 rounded-lg text-xs resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 max-h-20 bg-white"
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = Math.min(target.scrollHeight, 80) + 'px'
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSendingMessage}
                      size="sm"
                      className="h-8 w-8 rounded-full p-0 flex-shrink-0 bg-green-600 hover:bg-green-700"
                    >
                      {isSendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Authorization Panel */}
            <div className="bg-white rounded-lg border shadow-sm flex flex-col">
              <div className={`px-4 py-3 border-b ${isAuthorized ? 'bg-green-50' : 'bg-blue-50'}`}>
                <div className="flex items-center gap-2">
                  {isAuthorized ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                  )}
                  <h2 className={`font-semibold text-[13px] ${isAuthorized ? 'text-green-800' : 'text-blue-800'}`}>
                    {isAuthorized ? 'Authorized' : 'Authorization'}
                  </h2>
                </div>
              </div>
              <div className="p-4">
                {isAuthorized ? (
                  <p className="text-[12px] text-gray-600 text-center">
                    This certificate has been authorized and is now complete.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-500 mb-3 text-center">
                      By authorizing, you confirm the certificate is complete and approved by the customer.
                    </p>
                    <Button
                      onClick={() => setShowAuthorizeModal(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-sm h-10"
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Authorize & Sign
                    </Button>
                  </>
                )}
              </div>

              {/* Certificate Info */}
              <div className="px-4 py-3 border-t bg-gray-50">
                <div className="text-xs text-gray-600 space-y-1">
                  <p><span className="text-gray-400">Revision:</span> {certificate?.currentRevision}</p>
                  <p><span className="text-gray-400">Created by:</span> {certificate?.createdBy?.name || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authorize Modal */}
      <SignatureModal
        isOpen={showAuthorizeModal}
        onClose={() => {
          setShowAuthorizeModal(false)
          setAuthorizeError(null)
        }}
        onConfirm={handleAuthorize}
        title="Authorize Certificate"
        description="Please sign below to authorize this calibration certificate. Your signature will be added as the final authorization."
        confirmLabel="Confirm Authorization"
        loading={isAuthorizing}
        error={authorizeError}
      />
    </div>
  )
}
