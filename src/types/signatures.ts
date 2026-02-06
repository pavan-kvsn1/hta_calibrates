export interface SignatureData {
  signatureImage: string // base64 PNG from canvas
  signerName: string
}

export type SignerType = 'ENGINEER' | 'HOD' | 'CUSTOMER'
