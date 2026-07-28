import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { InputField } from '../InputField';
import { SelectField } from '../SelectField';
import { CheckboxField } from '../CheckboxField';
import { NumberField } from '../NumberField';
import { JsonField } from '../JsonField';
import { MultiSelect } from '../MultiSelect';
import { DataTable } from '../DataTable';
import type { ColumnDef } from '../DataTable';
import { Pagination } from '../Pagination';
import { Modal } from '../Modal';
import { Drawer } from '../Drawer';

function FormWrapper({ children, defaultValues = {}, mode }: { children: React.ReactNode; defaultValues?: Record<string, unknown>; mode?: 'onBlur' | 'onChange' | 'onSubmit' | 'onTouched' | 'all' }) {
  const methods = useForm({ defaultValues, mode });
  return (
    <FormProvider {...methods}>
      <form>{children}</form>
    </FormProvider>
  );
}

describe('InputField', () => {
  it('renders label and input and registers with react-hook-form', () => {
    render(
      <FormWrapper>
        <InputField name="email" label="Email" data-testid="email-input" />
      </FormWrapper>
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toHaveAttribute('name', 'email');
  });
});

describe('SelectField', () => {
  it('renders options', () => {
    render(
      <FormWrapper>
        <SelectField
          name="role"
          label="Role"
          options={[{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]}
        />
      </FormWrapper>
    );
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('admin');
    expect(screen.getByText('User')).toBeInTheDocument();
  });
});

describe('CheckboxField', () => {
  it('renders a checkbox', () => {
    render(
      <FormWrapper>
        <CheckboxField name="active" label="Active" />
      </FormWrapper>
    );
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
    expect(screen.getByLabelText('Active')).not.toBeChecked();
  });
});

describe('NumberField', () => {
  it('renders a number input', () => {
    render(
      <FormWrapper>
        <NumberField name="quantity" label="Quantity" data-testid="qty" />
      </FormWrapper>
    );
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByTestId('qty')).toHaveAttribute('type', 'number');
  });
});

describe('JsonField', () => {
  it('renders textarea and validates JSON on blur', async () => {
    render(
      <FormWrapper mode="onBlur">
        <JsonField name="config" label="Config" data-testid="config" />
      </FormWrapper>
    );
    const textarea = screen.getByTestId('config');
    fireEvent.change(textarea, { target: { value: '{"a":1' } });
    fireEvent.blur(textarea);
    expect(await screen.findByText(/Invalid JSON/i)).toBeInTheDocument();
  });
});

describe('MultiSelect', () => {
  it('toggles checkbox values', () => {
    render(
      <FormWrapper defaultValues={{ tags: [] }}>
        <MultiSelect
          name="tags"
          label="Tags"
          options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
        />
      </FormWrapper>
    );
    const a = screen.getByLabelText('A');
    expect(a).not.toBeChecked();
    fireEvent.click(a);
    expect(a).toBeChecked();
    fireEvent.click(a);
    expect(a).not.toBeChecked();
  });
});

interface TestRow {
  id: string;
  name: string;
  value: number;
}

describe('DataTable', () => {
  const data: TestRow[] = [
    { id: '1', name: 'Alpha', value: 10 },
    { id: '2', name: 'Beta', value: 20 },
  ];
  const columns: ColumnDef<TestRow>[] = [
    { key: 'name', header: 'Name' },
    { key: 'value', header: 'Value', align: 'right' },
  ];

  it('renders rows and columns', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        keyExtractor={(row) => row.id}
      />
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders empty message when data is empty', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={(row) => row.id}
        emptyMessage="No rows"
      />
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('disables prev when hasPrev is false and calls next', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(
      <Pagination
        pageSize={10}
        hasPrev={false}
        hasNext={true}
        onPrev={onPrev}
        onNext={onNext}
      />
    );
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe('Modal', () => {
  it('renders when open and closes on escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Confirm">
        <p>Modal body</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        <p>Modal body</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Drawer', () => {
  it('renders when open and closes on escape', () => {
    const onClose = vi.fn();
    render(
      <Drawer isOpen={true} onClose={onClose} title="Details">
        <p>Drawer body</p>
      </Drawer>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
