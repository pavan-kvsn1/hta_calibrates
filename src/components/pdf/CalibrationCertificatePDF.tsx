'use client'

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import { CertificateFormData, ACCURACY_TYPE_CONFIG } from '@/lib/certificate-store'
import { HTA_LOGO_BASE64 } from './logo-base64'
import {
  formatDateDDMMYYYY,
  padSerialNumber,
  formatCompoundSerial,
  getPrecisionFromLeastCount,
  formatWithPrecision,
  getConclusionText,
  COMPANY_INFO,
  SIGNATORIES,
  FOOTER_NOTES,
  VALIDITY_STATEMENT,
} from './pdf-utils'

// ============================================================================
// STYLES - Balanced layout with proper spacing and alignment
// ============================================================================
const styles = StyleSheet.create({
  // Page
  page: {
    paddingTop: 15,
    paddingBottom: 45, // Space for footer
    paddingHorizontal: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.3,
  },

  // Section A: Letterhead - compact height
  letterhead: {
    flexDirection: 'row',
    marginBottom: 0,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  logo: {
    width: 50,
    height: 50,
  },
  companyInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 1,
  },
  certification: {
    fontSize: 8,
    textAlign: 'center',
    marginBottom: 1,
  },
  addressLine: {
    fontSize: 7,
    textAlign: 'center',
    color: '#333',
    lineHeight: 1.2,
  },
  contactLine: {
    fontSize: 7,
    textAlign: 'center',
    color: '#333',
    marginTop: 1,
  },

  // Section B: Document Title - no gap from header
  titleSection: {
    marginTop: 0,
    marginBottom: 8,
    paddingVertical: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  // Absolutely positioned page number (repeats on each page)
  pageNumber: {
    position: 'absolute',
    top: 60,
    right: 40,
    fontSize: 10,
    color: '#000',
  },

  // Section C: Customer Info Table (4-column paired: label-value-label-value)
  customerTable: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 10,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    minHeight: 22,
  },
  customerRowLast: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 22,
  },
  customerLabelCell: {
    width: '20%',
    padding: 4,
    backgroundColor: '#f5f5f5',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  customerValueCell: {
    width: '30%',
    padding: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  customerLabelCellRight: {
    width: '18%',
    padding: 4,
    backgroundColor: '#f5f5f5',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  customerValueCellRight: {
    width: '32%',
    padding: 4,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  customerLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  customerValue: {
    fontSize: 8.5,
  },

  // Section D: UUC Details Table (4-column paired)
  uucTable: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 10,
  },
  uucRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    minHeight: 18,
  },
  uucRowLast: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 18,
  },
  uucLabelCell: {
    width: '18%',
    padding: 4,
    backgroundColor: '#f5f5f5',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  uucValueCell: {
    width: '32%',
    padding: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  uucLabelCellRight: {
    width: '15%',
    padding: 4,
    backgroundColor: '#f5f5f5',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  uucValueCellRight: {
    width: '35%',
    padding: 4,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  uucLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  uucValue: {
    fontSize: 8.5,
  },

  // Section E & F: Environmental & SOP Reference
  infoLine: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    width: 180,
  },
  infoValue: {
    fontSize: 9.5,
    flex: 1,
  },

  // Section G: Calibration Data Table
  calibrationSection: {
    marginBottom: 12,
  },
  calibrationHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    backgroundColor: '#e8e8e8',
    padding: 4,
  },
  calibrationTable: {
    borderWidth: 1,
    borderColor: '#000',
  },
  calibrationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
  },
  calibrationSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
  },
  calibrationDataRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    minHeight: 16,
  },
  calibrationDataRowLast: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 16,
  },
  calCell: {
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  calCellLast: {
    padding: 3,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  // For merged cell appearance (no bottom border)
  calCellMerged: {
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderBottomWidth: 0,
  },
  calHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  calSubHeaderText: {
    fontSize: 8,
    textAlign: 'center',
  },
  calCellText: {
    fontSize: 8,
    textAlign: 'center',
  },
  calCellTextLeft: {
    fontSize: 8,
    textAlign: 'left',
  },

  // Section H: Master Instruments - fixed width labels for alignment
  masterSection: {
    marginBottom: 10,
  },
  masterHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  masterBlock: {
    marginBottom: 6,
  },
  masterLine: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  masterLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    width: 115,
  },
  masterColon: {
    fontSize: 8.5,
    width: 15,
  },
  masterValue: {
    fontSize: 8.5,
    flex: 1,
  },
  masterDualLine: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  masterDualLeft: {
    flexDirection: 'row',
    width: '50%',
  },
  masterDualRight: {
    flexDirection: 'row',
    width: '50%',
  },
  masterDualLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    width: 115,
  },
  masterDualColon: {
    fontSize: 8.5,
    width: 15,
  },
  masterDualValue: {
    fontSize: 8.5,
    flex: 1,
  },

  // Section I: Conclusion
  conclusionSection: {
    marginBottom: 8,
  },
  conclusionHeader: {
    flexDirection: 'row',
  },
  conclusionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 90,
  },
  conclusionStatements: {
    flex: 1,
  },
  conclusionText: {
    fontSize: 10,
    marginBottom: 2,
  },

  // Section J: Validity Statement
  validitySection: {
    marginBottom: 2,
    paddingVertical: 2,
  },
  validityText: {
    fontSize: 10,
    fontStyle: 'italic',
  },

  // Section K: Signature Block (3-column)
  signatureSection: {
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#000',
    paddingTop: 4,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureColumn: {
    width: '32%',
  },
  signatureLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  signatureName: {
    fontSize: 9,
    marginBottom: 20,
  },
  signatureBox: {
    height: 22,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999',
    borderBottomStyle: 'dashed',
    marginBottom: 3,
  },

  // Section L: Footer Notes - fixed at bottom
  footerSection: {
    position: 'absolute',
    bottom: 12,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    paddingTop: 3,
  },
  footerNote: {
    fontSize: 7,
    marginBottom: 3,
    lineHeight: 1.3,
  },

  // Page continuation indicator
  continuedText: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'right',
    color: '#666',
    marginTop: 5,
  },
})

// ============================================================================
// COMPONENT PROPS
// ============================================================================
interface CalibrationCertificatePDFProps {
  data: CertificateFormData
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function CalibrationCertificatePDF({ data }: CalibrationCertificatePDFProps) {
  // Helper to get least count from parameter (handles binning)
  const getLeastCount = (p: typeof data.parameters[0]): string | null => {
    if (p.requiresBinning && p.bins.length > 0) {
      // Get unique least count values from bins
      const uniqueValues = [...new Set(p.bins.map(b => b.leastCount).filter(Boolean))]
      if (uniqueValues.length === 1) {
        return `${uniqueValues[0]} ${p.parameterUnit}`
      } else if (uniqueValues.length > 1) {
        return uniqueValues.map(v => `${v} ${p.parameterUnit}`).join(', ')
      }
      return null
    }
    return p.leastCountValue ? `${p.leastCountValue} ${p.parameterUnit}` : null
  }

  // Helper to get accuracy from parameter (handles binning and shows accuracy type)
  const getAccuracy = (p: typeof data.parameters[0]): string | null => {
    const accuracyTypeLabel = ACCURACY_TYPE_CONFIG[p.accuracyType]?.shortLabel || ''

    if (p.requiresBinning && p.bins.length > 0) {
      // Get unique accuracy values from bins
      const uniqueValues = [...new Set(p.bins.map(b => b.accuracy).filter(Boolean))]
      if (uniqueValues.length === 1) {
        const unit = p.accuracyType === 'ABSOLUTE' ? p.parameterUnit : accuracyTypeLabel
        return `± ${uniqueValues[0]} ${unit}`
      } else if (uniqueValues.length > 1) {
        const unit = p.accuracyType === 'ABSOLUTE' ? p.parameterUnit : accuracyTypeLabel
        return uniqueValues.map(v => `± ${v} ${unit}`).join(', ')
      }
      return null
    }

    if (p.accuracyValue) {
      const unit = p.accuracyType === 'ABSOLUTE' ? p.parameterUnit : accuracyTypeLabel
      return `± ${p.accuracyValue} ${unit}`
    }
    return null
  }

  // Derive combined values from parameters
  const leastCountStr = data.parameters
    .map(getLeastCount)
    .filter(Boolean)
    .join(', ') || '-'

  const operatingRangeStr = data.parameters
    .filter(p => p.operatingMin && p.operatingMax)
    .map(p => `${p.operatingMin} to ${p.operatingMax} ${p.parameterUnit}`)
    .join(', ') || '-'

  const accuracyStr = data.parameters
    .map(getAccuracy)
    .filter(Boolean)
    .join(', ') || '-'

  // Get unique SOP references from parameters
  const sopReferences = data.parameters
    .filter(p => p.sopReference)
    .map(p => p.sopReference)
    .filter((v, i, a) => a.indexOf(v) === i)

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ================================================================ */}
        {/* SECTION A: LETTERHEAD (fixed - repeats on each page) */}
        {/* ================================================================ */}
        <View style={styles.letterhead} fixed>
          <Image style={styles.logo} src={HTA_LOGO_BASE64} />
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{COMPANY_INFO.name}</Text>
            <Text style={styles.certification}>{COMPANY_INFO.certification}</Text>
            <Text style={styles.addressLine}>{COMPANY_INFO.address.line1}</Text>
            <Text style={styles.addressLine}>{COMPANY_INFO.address.line2}</Text>
            <Text style={styles.contactLine}>
              Tel: {COMPANY_INFO.contact.phone.join(', ')} | Web: {COMPANY_INFO.contact.website} | Email: {COMPANY_INFO.contact.email}
            </Text>
          </View>
        </View>

        {/* ================================================================ */}
        {/* SECTION B: DOCUMENT TITLE (fixed - repeats on each page) */}
        {/* ================================================================ */}
        <View style={styles.titleSection} fixed>
          <Text style={styles.title}>Calibration Certificate</Text>
        </View>

        {/* Page number - absolutely positioned (fixed - repeats on each page) */}
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />

        {/* ================================================================ */}
        {/* SECTION C: CUSTOMER INFO TABLE (4-column paired) */}
        {/* ================================================================ */}
        <View style={styles.customerTable} wrap={false}>
          {/* Row 1: Customer Name & Address / Date of Calibration */}
          <View style={styles.customerRow}>
            <View style={styles.customerLabelCell}>
              <Text style={styles.customerLabel}>Customer Name{'\n'}& Address</Text>
            </View>
            <View style={styles.customerValueCell}>
              <Text style={styles.customerValue}>{data.customerName || '-'}</Text>
              {data.customerAddress && (
                <Text style={styles.customerValue}>{data.customerAddress}</Text>
              )}
            </View>
            <View style={styles.customerLabelCellRight}>
              <Text style={styles.customerLabel}>Date of{'\n'}Calibration</Text>
            </View>
            <View style={styles.customerValueCellRight}>
              <Text style={styles.customerValue}>{formatDateDDMMYYYY(data.dateOfCalibration)}</Text>
            </View>
          </View>
          {/* Row 2: Certificate No. / Recommended Cal Due */}
          <View style={styles.customerRowLast}>
            <View style={styles.customerLabelCell}>
              <Text style={styles.customerLabel}>Certificate No.</Text>
            </View>
            <View style={styles.customerValueCell}>
              <Text style={styles.customerValue}>{data.certificateNumber || '-'}</Text>
            </View>
            <View style={styles.customerLabelCellRight}>
              <Text style={styles.customerLabel}>Recommended{'\n'}Cal Due</Text>
            </View>
            <View style={styles.customerValueCellRight}>
              <Text style={styles.customerValue}>{formatDateDDMMYYYY(data.calibrationDueDate)}</Text>
            </View>
          </View>
        </View>

        {/* ================================================================ */}
        {/* SECTION D: UUC DETAILS TABLE (4-column paired) */}
        {/* ================================================================ */}
        <View style={styles.uucTable} wrap={false}>
          {/* Row 1: UUC / Make */}
          <View style={styles.uucRow}>
            <View style={styles.uucLabelCell}>
              <Text style={styles.uucLabel}>Unit Under{'\n'}Calibration [UUC]</Text>
            </View>
            <View style={styles.uucValueCell}>
              <Text style={styles.uucValue}>{data.uucDescription || '-'}</Text>
            </View>
            <View style={styles.uucLabelCellRight}>
              <Text style={styles.uucLabel}>Make</Text>
            </View>
            <View style={styles.uucValueCellRight}>
              <Text style={styles.uucValue}>{data.uucMake || '-'}</Text>
            </View>
          </View>

          {/* Row 2: Location Name / Model */}
          <View style={styles.uucRow}>
            <View style={styles.uucLabelCell}>
              <Text style={styles.uucLabel}>Location Name</Text>
            </View>
            <View style={styles.uucValueCell}>
              <Text style={styles.uucValue}>{data.uucLocationName || '-'}</Text>
            </View>
            <View style={styles.uucLabelCellRight}>
              <Text style={styles.uucLabel}>Model</Text>
            </View>
            <View style={styles.uucValueCellRight}>
              <Text style={styles.uucValue}>{data.uucModel || '-'}</Text>
            </View>
          </View>

          {/* Row 3: Machine Name / Id. No. */}
          <View style={styles.uucRow}>
            <View style={styles.uucLabelCell}>
              <Text style={styles.uucLabel}>Machine Name</Text>
            </View>
            <View style={styles.uucValueCell}>
              <Text style={styles.uucValue}>{data.uucMachineName || '-'}</Text>
            </View>
            <View style={styles.uucLabelCellRight}>
              <Text style={styles.uucLabel}>Id. No.</Text>
            </View>
            <View style={styles.uucValueCellRight}>
              <Text style={styles.uucValue}>{data.uucSerialNumber || data.uucInstrumentId || '-'}</Text>
            </View>
          </View>

          {/* Row 4: Least Count / Accuracy */}
          <View style={styles.uucRow}>
            <View style={styles.uucLabelCell}>
              <Text style={styles.uucLabel}>Least Count</Text>
            </View>
            <View style={styles.uucValueCell}>
              <Text style={styles.uucValue}>{leastCountStr}</Text>
            </View>
            <View style={styles.uucLabelCellRight}>
              <Text style={styles.uucLabel}>Accuracy</Text>
            </View>
            <View style={styles.uucValueCellRight}>
              <Text style={styles.uucValue}>{accuracyStr}</Text>
            </View>
          </View>

          {/* Row 5: Operating Range / Calibrated at */}
          <View style={styles.uucRowLast}>
            <View style={styles.uucLabelCell}>
              <Text style={styles.uucLabel}>Operating Range</Text>
            </View>
            <View style={styles.uucValueCell}>
              <Text style={styles.uucValue}>{operatingRangeStr}</Text>
            </View>
            <View style={styles.uucLabelCellRight}>
              <Text style={styles.uucLabel}>Calibrated at</Text>
            </View>
            <View style={styles.uucValueCellRight}>
              <Text style={styles.uucValue}>{data.calibratedAt === 'LAB' ? 'Lab' : 'Site'}</Text>
            </View>
          </View>
        </View>

        {/* ================================================================ */}
        {/* SECTION E: ENVIRONMENTAL CONDITION */}
        {/* ================================================================ */}
        <View style={styles.infoLine} wrap={false}>
          <Text style={styles.infoLabel}>Environmental Condition :</Text>
          <Text style={styles.infoValue}>
            {data.ambientTemperature ? `${data.ambientTemperature} °C` : '-'}
            {data.relativeHumidity ? `, ${data.relativeHumidity} %RH` : ''}
          </Text>
        </View>

        {/* ================================================================ */}
        {/* SECTION F: CALIBRATION PROCEDURE REFERENCE */}
        {/* ================================================================ */}
        <View style={styles.infoLine} wrap={false}>
          <Text style={styles.infoLabel}>Calibration procedure reference :</Text>
          <Text style={styles.infoValue}>
            {sopReferences.length > 0
              ? `HTA Cal Procedure ${sopReferences.join(', ')}`
              : '-'}
          </Text>
        </View>

        {/* ================================================================ */}
        {/* SECTION G: CALIBRATION DATA TABLES (per parameter) */}
        {/* ================================================================ */}
        {data.parameters.map((param, paramIdx) => {
          const precision = getPrecisionFromLeastCount(param.leastCountValue)
          const rangeStr = param.rangeMin && param.rangeMax
            ? `${param.rangeMin} to ${param.rangeMax} ${param.parameterUnit}`
            : ''
          const middleRowIdx = Math.floor(param.results.length / 2)

          return (
            <View key={param.id} style={styles.calibrationSection} wrap={false}>
              <View style={styles.calibrationTable}>
                {/* Header Row 1 */}
                <View style={styles.calibrationHeaderRow}>
                  <View style={[styles.calCell, { width: '8%' }]}>
                    <Text style={styles.calHeaderText}>Sl.</Text>
                    <Text style={styles.calHeaderText}>No.</Text>
                  </View>
                  <View style={[styles.calCell, { width: '20%' }]}>
                    <Text style={styles.calHeaderText}>Parameter &</Text>
                    <Text style={styles.calHeaderText}>Range</Text>
                  </View>
                  <View style={[styles.calCell, { width: '18%' }]}>
                    <Text style={styles.calHeaderText}>Standard Meter</Text>
                    <Text style={styles.calHeaderText}>Reading (y)</Text>
                  </View>
                  <View style={[styles.calCell, { width: '18%' }]}>
                    <Text style={styles.calHeaderText}>UUC Reading</Text>
                    <Text style={styles.calHeaderText}>(x)</Text>
                  </View>
                  <View style={[styles.calCell, { width: '18%' }]}>
                    <Text style={styles.calHeaderText}>Error Observed</Text>
                    <Text style={styles.calHeaderText}>(±) z = (x-y)</Text>
                  </View>
                  <View style={[styles.calCellLast, { width: '18%' }]}>
                    <Text style={styles.calHeaderText}>Remarks</Text>
                  </View>
                </View>

                {/* Sub-header Row (units) */}
                <View style={styles.calibrationSubHeaderRow}>
                  <View style={[styles.calCell, { width: '8%' }]}>
                    <Text style={styles.calSubHeaderText}></Text>
                  </View>
                  <View style={[styles.calCell, { width: '20%' }]}>
                    <Text style={styles.calSubHeaderText}>{param.parameterName?.toUpperCase() || ''}</Text>
                  </View>
                  <View style={[styles.calCell, { width: '18%' }]}>
                    <Text style={styles.calSubHeaderText}>{param.parameterUnit}</Text>
                  </View>
                  <View style={[styles.calCell, { width: '18%' }]}>
                    <Text style={styles.calSubHeaderText}>{param.parameterUnit}</Text>
                  </View>
                  <View style={[styles.calCell, { width: '18%' }]}>
                    <Text style={styles.calSubHeaderText}>{param.parameterUnit}</Text>
                  </View>
                  <View style={[styles.calCellLast, { width: '18%' }]}>
                    <Text style={styles.calSubHeaderText}></Text>
                  </View>
                </View>

                {/* Data section with merged Parameter & Range column */}
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  {/* Sl. No. column (individual cells per row) */}
                  <View style={{ width: '8%' }}>
                    {param.results.map((result, resultIdx) => {
                      const isLastRow = resultIdx === param.results.length - 1
                      return (
                        <View
                          key={`sl-${result.id}`}
                          style={[styles.calCell, {
                            width: '100%',
                            minHeight: 16,
                            borderBottomWidth: isLastRow ? 0 : 0.5,
                            borderBottomColor: '#000',
                          }]}
                        >
                          <Text style={styles.calCellText}>{padSerialNumber(result.pointNumber)}</Text>
                        </View>
                      )
                    })}
                  </View>

                  {/* Merged Parameter & Range column (single cell spanning all rows) */}
                  <View style={[styles.calCell, { width: '20%', minHeight: param.results.length * 16 }]}>
                    <Text style={styles.calCellText}>{rangeStr || '-'}</Text>
                  </View>

                  {/* Other data columns (individual cells per row) */}
                  <View style={{ width: '72%' }}>
                    {param.results.map((result, resultIdx) => {
                      const isLastRow = resultIdx === param.results.length - 1

                      return (
                        <View
                          key={result.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'stretch',
                            minHeight: 16,
                            borderBottomWidth: isLastRow ? 0 : 0.5,
                            borderBottomColor: '#000',
                          }}
                        >
                          <View style={[styles.calCell, { width: '25%' }]}>
                            <Text style={styles.calCellText}>
                              {formatWithPrecision(result.standardReading, precision)}
                            </Text>
                          </View>
                          <View style={[styles.calCell, { width: '25%' }]}>
                            <Text style={styles.calCellText}>
                              {formatWithPrecision(result.beforeAdjustment, precision)}
                            </Text>
                          </View>
                          <View style={[styles.calCell, { width: '25%' }]}>
                            <Text style={styles.calCellText}>
                              {result.errorObserved !== null
                                ? formatWithPrecision(result.errorObserved, precision)
                                : '-'}
                            </Text>
                          </View>
                          <View style={[styles.calCellLast, { width: '25%' }]}>
                            <Text style={styles.calCellText}>
                              {result.errorObserved !== null
                                ? (result.isOutOfLimit ? 'Fail' : 'Pass')
                                : '-'}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </View>
            </View>
          )
        })}

        {/* ================================================================ */}
        {/* SECTION H: MASTER INSTRUMENTS USED DETAILS */}
        {/* ================================================================ */}
        <View style={styles.masterSection} wrap={false}>
          <Text style={styles.masterHeader}>MASTER INSTRUMENTS USED DETAILS:-</Text>

          {data.masterInstruments
            .filter(m => m.masterInstrumentId)
            .map((master, idx) => (
              <View key={master.id} style={styles.masterBlock}>
                {/* INST. DESCRIPTION */}
                <View style={styles.masterLine}>
                  <Text style={styles.masterLabel}>INST. DESCRIPTION</Text>
                  <Text style={styles.masterColon}>:</Text>
                  <Text style={styles.masterValue}>{master.description || '-'}</Text>
                </View>

                {/* MAKE / MODEL */}
                <View style={styles.masterDualLine}>
                  <View style={styles.masterDualLeft}>
                    <Text style={styles.masterDualLabel}>MAKE</Text>
                    <Text style={styles.masterDualColon}>:</Text>
                    <Text style={styles.masterDualValue}>{master.make || '-'}</Text>
                  </View>
                  <View style={styles.masterDualRight}>
                    <Text style={styles.masterDualLabel}>MODEL</Text>
                    <Text style={styles.masterDualColon}>:</Text>
                    <Text style={styles.masterDualValue}>{master.model || '-'}</Text>
                  </View>
                </View>

                {/* SL. NO. / CALIBRATION DUE */}
                <View style={styles.masterDualLine}>
                  <View style={styles.masterDualLeft}>
                    <Text style={styles.masterDualLabel}>SL. NO.</Text>
                    <Text style={styles.masterDualColon}>:</Text>
                    <Text style={styles.masterDualValue}>{master.serialNumber || '-'}</Text>
                  </View>
                  <View style={styles.masterDualRight}>
                    <Text style={styles.masterDualLabel}>CALIBRATION DUE</Text>
                    <Text style={styles.masterDualColon}>:</Text>
                    <Text style={styles.masterDualValue}>{formatDateDDMMYYYY(master.calibrationDueDate)}</Text>
                  </View>
                </View>

                {/* CERTIFICATE NO. / CALIBRATED AT */}
                <View style={styles.masterDualLine}>
                  <View style={styles.masterDualLeft}>
                    <Text style={styles.masterDualLabel}>CERTIFICATE NO.</Text>
                    <Text style={styles.masterDualColon}>:</Text>
                    <Text style={styles.masterDualValue}>{master.reportNo || '-'}</Text>
                  </View>
                  <View style={styles.masterDualRight}>
                    <Text style={styles.masterDualLabel}>CALIBRATED AT</Text>
                    <Text style={styles.masterDualColon}>:</Text>
                    <Text style={styles.masterDualValue}>{master.calibratedAt || '-'}</Text>
                  </View>
                </View>
              </View>
            ))}
        </View>

        {/* ================================================================ */}
        {/* SECTION I: CONCLUSION */}
        {/* ================================================================ */}
        {data.selectedConclusionStatements.length > 0 && (
          <View style={styles.conclusionSection} wrap={false}>
            <View style={styles.conclusionHeader}>
              <Text style={styles.conclusionLabel}>Conclusion</Text>
              <View style={styles.conclusionStatements}>
                {data.selectedConclusionStatements.map((statementKey, idx) => (
                  <Text key={idx} style={styles.conclusionText}>
                    :    {idx + 1}. {getConclusionText(statementKey)}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* SECTION J: VALIDITY STATEMENT */}
        {/* ================================================================ */}
        <View style={styles.validitySection} wrap={false}>
          <Text style={styles.validityText}>{VALIDITY_STATEMENT}</Text>
        </View>

        {/* ================================================================ */}
        {/* SECTION K: SIGNATURE BLOCK (3-column) */}
        {/* ================================================================ */}
        <View style={styles.signatureSection} wrap={false}>
          <View style={styles.signatureRow}>
            {/* Column 1: Calibrated By / Report Prepared By */}
            <View style={styles.signatureColumn}>
              <Text style={styles.signatureLabel}>CALIBRATED BY:</Text>
              <Text style={styles.signatureName}>{SIGNATORIES.calibratedBy}</Text>
              <Text style={styles.signatureLabel}>REPORT PREPARED BY:</Text>
              <Text style={styles.signatureName}>{SIGNATORIES.reportPreparedBy}</Text>
            </View>

            {/* Column 2: Checked By */}
            <View style={styles.signatureColumn}>
              <Text style={styles.signatureLabel}>CHECKED BY</Text>
              <View style={styles.signatureBox} />
              <Text style={styles.signatureName}>{SIGNATORIES.checkedBy}</Text>
            </View>

            {/* Column 3: Approved & Issued By */}
            <View style={styles.signatureColumn}>
              <Text style={styles.signatureLabel}>APPROVED & ISSUED BY</Text>
              <View style={styles.signatureBox} />
              <Text style={styles.signatureName}>{SIGNATORIES.approvedIssuedBy}</Text>
            </View>
          </View>
        </View>

        {/* ================================================================ */}
        {/* SECTION L: FOOTER NOTES */}
        {/* ================================================================ */}
        <View style={styles.footerSection} fixed>
          {FOOTER_NOTES.map((note, idx) => (
            <Text key={idx} style={styles.footerNote}>
              {idx + 1}. {note}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export default CalibrationCertificatePDF
