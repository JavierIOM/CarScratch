import { jsPDF } from 'jspdf';

interface PDFVehicleData {
  registration: string;
  isManx?: boolean;
  vehicle?: {
    make: string;
    model?: string;
    colour: string;
    fuelType: string;
    engineCapacity: number;
    co2Emissions?: number;
    yearOfManufacture: number;
    taxStatus: string;
    taxDueDate?: string;
    motStatus: string;
    motExpiryDate?: string;
    monthOfFirstRegistration?: string;
    euroStatus?: string;
  };
  extras?: {
    bhp?: number;
    topSpeed?: string;
    zeroToSixty?: string;
    maxTorque?: string;
    bodyStyle?: string;
    transmission?: string;
    driveType?: string;
    insuranceGroup?: string;
    ulezCompliant?: boolean;
    cazCompliant?: boolean;
    fuelEconomyUrban?: string;
    fuelEconomyExtraUrban?: string;
    fuelEconomyCombined?: string;
    roadTax12Month?: string;
    roadTax6Month?: string;
    previousUKRegistration?: string;
    dateOfFirstRegistrationIOM?: string;
    iomModel?: string;
    modelVariant?: string;
  };
  motSummary?: {
    totalTests: number;
    latestResult?: string;
    latestDate?: string;
    latestMileage?: string;
    earliestDate?: string;
    earliestMileage?: string;
  };
  auction?: {
    appearances: Array<{
      description: string;
      auctionDate: string;
      hammerPrice: number | null;
    }>;
  };
}

// Colours
const AMBER = [217, 119, 6];     // amber-600
const SLATE_900 = [15, 23, 42];
const SLATE_700 = [51, 65, 85];
const SLATE_500 = [100, 116, 139];
const SLATE_300 = [203, 213, 225];
const WHITE = [255, 255, 255];
const GREEN = [34, 197, 94];
const RED = [239, 68, 68];

function setColor(doc: jsPDF, rgb: number[]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function formatEngine(cc: number): string {
  if (!cc || cc === 0) return 'N/A';
  if (cc < 150) return `${cc}cc`;
  const litres = (cc / 1000).toFixed(1);
  return `${litres}L (${cc.toLocaleString()}cc)`;
}

export function generateVehiclePDF(data: PDFVehicleData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- HEADER ---
  doc.setFillColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Site name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setColor(doc, AMBER);
  doc.text('CarScratch', margin, 18);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, SLATE_500);
  doc.text('UK & Isle of Man Vehicle Information', margin, 25);

  // Registration plate (right side)
  const plateText = data.registration;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const plateWidth = doc.getTextWidth(plateText) + 14;
  const plateX = pageWidth - margin - plateWidth;

  // Plate background
  doc.setFillColor(255, 221, 0);
  doc.rect(plateX, 8, plateWidth, 14, 'F');

  // Plate badge
  const badgeWidth = 10;
  if (data.isManx) {
    doc.setFillColor(220, 38, 38);
    doc.rect(plateX, 8, badgeWidth, 14, 'F');
    doc.setFontSize(7);
    setColor(doc, WHITE);
    doc.text('M', plateX + badgeWidth / 2, 17, { align: 'center' });
  } else {
    doc.setFillColor(0, 51, 153);
    doc.rect(plateX, 8, badgeWidth, 14, 'F');
    doc.setFontSize(7);
    setColor(doc, WHITE);
    doc.text('GB', plateX + badgeWidth / 2, 17, { align: 'center' });
  }

  // Plate text
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  setColor(doc, SLATE_900);
  doc.text(plateText, plateX + badgeWidth + 3, 19);

  // IoM badge
  if (data.isManx) {
    doc.setFontSize(8);
    setColor(doc, SLATE_500);
    doc.text('Isle of Man Vehicle', pageWidth - margin, 32, { align: 'right' });
  }

  // Date generated
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(doc, SLATE_500);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, 35);

  y = 48;

  if (!data.vehicle) {
    doc.setFontSize(12);
    setColor(doc, SLATE_500);
    doc.text('No vehicle data available.', margin, y);
    doc.save(`${data.registration.replace(/\s/g, '')}-vehicle-summary.pdf`);
    return;
  }

  const v = data.vehicle;

  // --- VEHICLE SUMMARY ---
  y = drawSectionHeader(doc, 'Vehicle Summary', margin, y, contentWidth);

  // Make & model title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, SLATE_900);
  doc.text(`${v.make} ${v.model || ''}`.trim(), margin, y);
  y += 8;

  // Status badges inline
  const taxColor = v.taxStatus === 'Taxed' ? GREEN : RED;
  const motColor = v.motStatus === 'Valid' ? GREEN : RED;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  // Tax badge
  doc.setFillColor(taxColor[0], taxColor[1], taxColor[2]);
  doc.rect(margin, y - 4, 30, 6, 'F');
  setColor(doc, WHITE);
  doc.text(`Tax: ${v.taxStatus}`, margin + 15, y, { align: 'center' });

  // MOT badge
  doc.setFillColor(motColor[0], motColor[1], motColor[2]);
  doc.rect(margin + 34, y - 4, 30, 6, 'F');
  setColor(doc, WHITE);
  doc.text(`MOT: ${v.motStatus}`, margin + 34 + 15, y, { align: 'center' });

  y += 10;

  // Vehicle details grid (2 columns)
  const details: [string, string][] = [
    ['Colour', v.colour],
    ['Fuel Type', v.fuelType],
    ['Engine', formatEngine(v.engineCapacity)],
    ['Year', v.yearOfManufacture.toString()],
  ];
  if (v.co2Emissions) details.push(['CO2 Emissions', `${v.co2Emissions} g/km`]);
  if (v.euroStatus) details.push(['Euro Status', v.euroStatus]);
  if (v.taxDueDate) details.push(['Tax Due', v.taxDueDate]);
  if (v.motExpiryDate) details.push(['MOT Expires', v.motExpiryDate]);
  if (v.monthOfFirstRegistration) details.push(['First Registered', v.monthOfFirstRegistration]);

  y = drawDetailsGrid(doc, details, margin, y, contentWidth);
  y += 6;

  // --- ADDITIONAL INFORMATION ---
  if (data.extras) {
    const ex = data.extras;
    const extraDetails: [string, string][] = [];

    if (ex.bhp) extraDetails.push(['BHP', ex.bhp.toString()]);
    if (ex.topSpeed) extraDetails.push(['Top Speed', ex.topSpeed]);
    if (ex.zeroToSixty) extraDetails.push(['0-60 MPH', ex.zeroToSixty]);
    if (ex.maxTorque) extraDetails.push(['Max Torque', ex.maxTorque]);
    if (ex.bodyStyle) extraDetails.push(['Body Style', ex.bodyStyle]);
    if (ex.transmission) extraDetails.push(['Transmission', ex.transmission]);
    if (ex.driveType) extraDetails.push(['Drive Type', ex.driveType]);
    if (ex.insuranceGroup) extraDetails.push(['Insurance Group', ex.insuranceGroup]);
    if (ex.ulezCompliant !== undefined) extraDetails.push(['ULEZ Compliant', ex.ulezCompliant ? 'Yes' : 'No']);
    if (ex.fuelEconomyCombined) extraDetails.push(['MPG (Combined)', ex.fuelEconomyCombined]);
    if (ex.fuelEconomyUrban) extraDetails.push(['MPG (Urban)', ex.fuelEconomyUrban]);
    if (ex.fuelEconomyExtraUrban) extraDetails.push(['MPG (Extra Urban)', ex.fuelEconomyExtraUrban]);
    if (ex.roadTax12Month) extraDetails.push(['Road Tax (12 months)', ex.roadTax12Month]);
    if (ex.roadTax6Month) extraDetails.push(['Road Tax (6 months)', ex.roadTax6Month]);

    // IoM specific
    if (ex.previousUKRegistration) extraDetails.push(['Previous UK Reg', ex.previousUKRegistration]);
    if (ex.dateOfFirstRegistrationIOM) extraDetails.push(['IoM Registration Date', ex.dateOfFirstRegistrationIOM]);
    if (ex.modelVariant) extraDetails.push(['Model Variant', ex.modelVariant]);

    if (extraDetails.length > 0) {
      y = checkPageBreak(doc, y, 30);
      y = drawSectionHeader(doc, 'Additional Information', margin, y, contentWidth);
      y = drawDetailsGrid(doc, extraDetails, margin, y, contentWidth);
      y += 6;
    }
  }

  // --- AUCTION HISTORY ---
  if (data.auction && data.auction.appearances.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'Auction History', margin, y, contentWidth);

    for (const app of data.auction.appearances) {
      y = checkPageBreak(doc, y, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(doc, SLATE_700);
      doc.text(app.auctionDate, margin, y);
      doc.text(app.description, margin + 30, y);
      if (app.hammerPrice !== null) {
        doc.setFont('helvetica', 'bold');
        setColor(doc, AMBER);
        doc.text(`£${app.hammerPrice.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
      }
      y += 5;
    }
    y += 4;
  }

  // --- MOT SUMMARY ---
  if (data.motSummary && data.motSummary.totalTests > 0) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'MOT Summary', margin, y, contentWidth);

    const motDetails: [string, string][] = [
      ['Total Tests on Record', data.motSummary.totalTests.toString()],
    ];
    if (data.motSummary.latestResult) motDetails.push(['Latest Result', data.motSummary.latestResult]);
    if (data.motSummary.latestDate) motDetails.push(['Latest Test Date', data.motSummary.latestDate]);
    if (data.motSummary.latestMileage) motDetails.push(['Latest Mileage', data.motSummary.latestMileage]);
    if (data.motSummary.earliestDate) motDetails.push(['Earliest Test Date', data.motSummary.earliestDate]);
    if (data.motSummary.earliestMileage) motDetails.push(['Earliest Mileage', data.motSummary.earliestMileage]);

    y = drawDetailsGrid(doc, motDetails, margin, y, contentWidth);
    y += 6;
  }

  // --- FOOTER ---
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setColor(doc, SLATE_500);
  doc.text('Generated from carscratch.uk - Data sourced from DVLA, MOT History Service, IOM Government. For informational purposes only.', pageWidth / 2, footerY, { align: 'center' });

  // Save
  doc.save(`${data.registration.replace(/\s/g, '')}-vehicle-summary.pdf`);
}

function drawSectionHeader(doc: jsPDF, title: string, x: number, y: number, width: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, AMBER);
  doc.text(title, x, y);

  // Underline
  doc.setDrawColor(AMBER[0], AMBER[1], AMBER[2]);
  doc.setLineWidth(0.5);
  doc.line(x, y + 1.5, x + width, y + 1.5);

  return y + 8;
}

function drawDetailsGrid(doc: jsPDF, items: [string, string][], x: number, y: number, width: number): number {
  const colWidth = width / 2;

  for (let i = 0; i < items.length; i += 2) {
    y = checkPageBreak(doc, y, 8);

    // Alternate row background
    if (i % 4 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(x, y - 4, width, 6, 'F');
    }

    // Left column
    drawDetailItem(doc, items[i][0], items[i][1], x, y);

    // Right column (if exists)
    if (i + 1 < items.length) {
      drawDetailItem(doc, items[i + 1][0], items[i + 1][1], x + colWidth, y);
    }

    y += 6;
  }

  return y;
}

function drawDetailItem(doc: jsPDF, label: string, value: string, x: number, y: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, SLATE_500);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, SLATE_900);
  doc.text(value, x + 45, y);
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 15) {
    doc.addPage();
    return 15;
  }
  return y;
}
