import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf" },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 12,
    fontFamily: "Roboto",
  },
  header: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  subHeader: {
    fontSize: 12,
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 160,
    height: 100,
    marginLeft: 16,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontWeight: "bold",
  },
  receiptText: {
    marginTop: 32,
    marginBottom: 32,
  },
  footer: {
    marginTop: 40,
    fontSize: 11,
  },
});

const RemittanceReceiptPDF = ({
  stationName = "",
  amount = 0,
  collectedFrom = "",
  collectedTo = "",
  dateSubmitted = "",
  issuerName = "",
  submittedBy = "",
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.logoRow}>
        <View>
          <Text style={styles.header}>REMITTANCE RECEIPT</Text>
          <Text style={styles.subHeader}>EcoRide Parada</Text>
          <Text style={styles.subHeader}>
            S. De Guzman St, Valenzuela, Metro Manila
          </Text>
        </View>
        <Image style={styles.logo} src={"/assets/ecoridelogo.png"} />
      </View>

      <View style={styles.section}>
        <Text>
          <Text style={styles.label}>Received From: </Text>
          {stationName}
        </Text>
        <Text>
          <Text style={styles.label}>Amount: </Text>
          {amount.toFixed(2)} PHP
        </Text>
        <Text>
          <Text style={styles.label}>Period: </Text>
          {collectedFrom} - {collectedTo}
        </Text>
        <Text>
          <Text style={styles.label}>Date Submitted: </Text>
          {dateSubmitted}
        </Text>
      </View>

      <View style={styles.receiptText}>
        <Text>
          This receipt confirms that the amount of {amount.toFixed(2)} PHP has
          been received from {stationName} for the period {collectedFrom} to{" "}
          {collectedTo} on {dateSubmitted}.
        </Text>
      </View>

      <View style={styles.footer}>
        {submittedBy && <Text>Submitted By: {submittedBy}</Text>}
        <Text>Issued By: {issuerName}</Text>
      </View>
    </Page>
  </Document>
);

export default RemittanceReceiptPDF;
