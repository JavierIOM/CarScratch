import type { APIRoute } from 'astro';
import { getVehicleInfo } from '../../../lib/aggregator';

export const GET: APIRoute = async ({ params }) => {
  const reg = (params.reg ?? '').toUpperCase().replace(/\s/g, '');

  if (!reg) {
    return new Response(JSON.stringify({ error: 'No registration provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const info = await getVehicleInfo(reg);

    const motTests = info.motHistory?.motTests ?? [];
    const latestTest = motTests[0];

    const vehicle = info.vehicle ?? info.ukVehicle;

    return new Response(
      JSON.stringify({
        isManx: info.isManx ?? false,
        make: vehicle?.make,
        colour: vehicle?.colour,
        year: vehicle?.yearOfManufacture,
        fuelType: vehicle?.fuelType,
        taxStatus: vehicle?.taxStatus ?? null,
        taxDueDate: vehicle?.taxDueDate ?? null,
        motStatus: vehicle?.motStatus ?? null,
        motDueDate: vehicle?.motExpiryDate ?? null,
        mileage: latestTest?.odometerValue ?? null,
        mileageUnit: latestTest?.odometerUnit ?? null,
        motTestCount: motTests.length,
        error: info.error ?? null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Lookup failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
