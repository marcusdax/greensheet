import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrdersPage } from '../OrdersPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase, db } from '../../api/db';

describe('OrdersPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and create button', async () => {
    render(<OrdersPage />);
    expect(await screen.findByText('Orders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create order/i })).toBeInTheDocument();
  });

  it('creates an order, reserves inventory, and updates the order list', async () => {
    const accountId = '11111111-1111-4111-8111-111111111111';
    const lotId = '22222222-2222-4222-8222-222222222222';
    db.roasters.push({
      id: accountId,
      roasterName: 'Test Roaster',
      segment: 'micro',
      status: 'active',
      churnRiskScore: 0.1,
      ltvCents: 100000,
      cacCents: 10000,
      paybackMonths: 2,
      daysSinceLastOrder: 1,
      totalRevenueCents: 100000,
      totalOrders: 1,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryContact: { fullName: 'Test', email: 'test@example.com', marketingOptIn: false },
      interventions: [],
    });
    db.lots.push({
      id: lotId,
      origin: 'Test Origin',
      varietal: 'Test Varietal',
      processingMethod: 'washed',
      elevation: 1500,
      cupScore: 85,
      pricePerLbCents: 500,
      costPerLbCents: 350,
      availableQuantityLbs: 1000,
      totalProductionLbs: 2000,
      esgScore: 0.8,
      logisticsScore: 0.7,
      certifications: { fairTrade: false, organic: true, rainforestAlliance: false },
      flavorNotes: ['cocoa'],
      sensoryProfile: { acidity: 7, body: 7, sweetness: 7 },
      portOfOrigin: 'Test Port',
      estimatedArrival: new Date().toISOString(),
      status: 'active',
      lastUpdatedAt: new Date().toISOString(),
    });

    render(<OrdersPage />);
    await screen.findByText('Orders');

    fireEvent.click(screen.getByRole('button', { name: /create order/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Account'), { target: { value: accountId } });
    fireEvent.change(screen.getByLabelText('Lot'), { target: { value: lotId } });
    fireEvent.change(screen.getByLabelText('Qty (lb)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Price (¢/lb)'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: /save order/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Test Roaster')).toBeInTheDocument());

    const lot = db.lots.find((l) => l.id === lotId)!;
    expect(lot.availableQuantityLbs).toBe(990);
  });
});
