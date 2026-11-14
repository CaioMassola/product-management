'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowLeft, ImagePlus, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, errorKey } from '@/lib/api-client';
import {
  Button,
  Field,
  Input,
  PageHeading,
  Select,
} from '@/components/ui/controls';
import { MoneyInput } from '@/components/ui/money-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState, LoadingState } from '@/components/ui/query-state';
import { useInvalidateProducts, useProduct } from '../queries';
import {
  createProduct,
  updateProduct,
  uploadProductImage,
  removeProductImage,
  productImageUrl,
} from '../api';
import {
  MAX_IMAGE_BYTES,
  normalizeMoney,
  productSchema,
  type ProductFormValues,
} from '../validation';
import {
  PRODUCT_TYPES,
  type Product,
  type ProductInput,
  type ProductType,
} from '../types';
import { StatusBadge } from './status-badge';
import { StatusAction } from './status-action';
import { ProductImage } from './product-image';

function EditorHeading({
  editing,
  onBack,
}: {
  editing: boolean;
  onBack?: () => void;
}) {
  const t = useTranslations();

  return (
    <>
      {onBack ? (
        <button
          type="button"
          className="back-link"
          onClick={onBack}
        >
          <ArrowLeft
            size={16}
          />
          {t('common.back')}
        </button>
      ) : (
        <Link
          href="/products"
          className="back-link"
        >
          <ArrowLeft
            size={16}
          />
          {t('common.back')}
        </Link>
      )}
      <PageHeading
        title={t(editing ? 'form.editTitle' : 'form.newTitle')}
        description={t(editing ? 'form.editSubtitle' : 'form.subtitle')}
      />
    </>
  );
}

export function ProductEditor({ id }: { id?: string }) {
  const query = useProduct(id);
  if (id && query.isPending)
    return (
      <>
        <EditorHeading
          editing
        />
        <section
          className="panel"
        >
          <LoadingState />
        </section>
      </>
    );
  if (id && query.isError)
    return (
      <>
        <EditorHeading
          editing
        />
        <section
          className="panel"
        >
          <ErrorState
            error={query.error}
            retry={() => void query.refetch()}
          />
        </section>
      </>
    );

  return (
    <ProductForm
      key={id ?? 'new'}
      initialProduct={query.data}
    />
  );
}

function formValues(
  product: Product | undefined,
  formatPrice: (value: number) => string,
): ProductFormValues {
  return {
    code: product?.code ?? '',
    title: product?.title ?? '',
    description: product?.description ?? '',
    price: product ? formatPrice(product.price) : '',
    quantity: String(product?.quantity ?? 0),
    productType: product?.productType ?? '',
  };
}

function ProductForm({ initialProduct }: { initialProduct?: Product }) {
  const t = useTranslations();
  const format = useFormatter();

  const formatPrice = (value: number) =>
    format.number(value, {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const router = useRouter();
  const invalidate = useInvalidateProducts();
  const [savedProduct, setSavedProduct] = useState(initialProduct);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [preview, setPreview] = useState<string>();
  const previewRef = useRef<string | undefined>(undefined);
  const [discardOpen, setDiscardOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const schema = useMemo(
    () => productSchema((key) => t(`validation.${key}`)),
    [t],
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formValues(initialProduct, formatPrice),
  });

  const dirty = isDirty || Boolean(file) || removeImage;

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const input: ProductInput = {
        ...values,
        description: values.description || null,
        price: Number(normalizeMoney(values.price)),
        quantity: Number(values.quantity),
        productType: values.productType as ProductType,
      };

      let product = savedProduct
        ? await updateProduct(savedProduct.id, input)
        : await createProduct(input);
      // Retain the created ID before the image request so retries cannot create duplicate products.
      setSavedProduct(product);
      reset(formValues(product, formatPrice));
      try {
        if (file) product = await uploadProductImage(product.id, file);
        else if (removeImage && product.imageKey)
          product = await removeProductImage(product.id);
      } catch {
        setImageError(t('form.imagePartial'));
        await invalidate(product.id);

        return { product, partial: true };
      }

      setSavedProduct(product);
      setFile(null);
      setRemoveImage(false);
      await invalidate(product.id);

      return { product, partial: false };
    },
    onSuccess: (result) => {
      if (result.partial) {
        toast.warning(t('form.savedContinue'));

        return;
      }

      toast.success(
        t(initialProduct ? 'products.updated' : 'products.created'),
      );
      router.push(`/products/${result.product.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError)
        for (const field of Object.keys(error.fields)) {
          if (field in schema.shape)
            setError(field as keyof ProductFormValues, {
              message: t('validation.server'),
            });
        }

      toast.error(t(`errors.${errorKey(error)}`));
    },
  });

  const selectFile = (selected?: File) => {
    setImageError('');
    if (!selected) return;
    if (
      !['image/png', 'image/jpeg'].includes(selected.type) ||
      selected.size === 0 ||
      selected.size > MAX_IMAGE_BYTES
    ) {
      setImageError(t('form.imageInvalid'));

      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(selected);
    setPreview(previewRef.current);
    setFile(selected);
    setRemoveImage(false);
  };

  const imageSrc = file
    ? preview
    : !removeImage && savedProduct?.imageKey
      ? productImageUrl(savedProduct)
      : undefined;

  const attributes = (name: keyof ProductFormValues) => ({
    ...register(name),
    id: name,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  const exit = () => {
    if (dirty) setDiscardOpen(true);
    else router.push('/products');
  };

  return (
    <>
      <EditorHeading
        editing={Boolean(initialProduct)}
        onBack={exit}
      />
      <form
        onSubmit={handleSubmit((values) => {
          setImageError('');
          mutation.mutate(values);
        })}
        noValidate
      >
        <section
          className="panel form-panel"
        >
          <h2>{t('form.information')}</h2>
          {mutation.isError && (
            <p
              className="notice notice-error"
              role="alert"
            >
              {t(`errors.${errorKey(mutation.error)}`)}
            </p>
          )}
          <fieldset
            disabled={mutation.isPending}
            className="product-form-grid"
          >
            <Field
              label={t('form.code')}
              id="code"
              required
              error={errors.code?.message}
            >
              <Input
                {...attributes('code')}
                maxLength={64}
                required
                autoComplete="off"
                placeholder="PROD-00001"
              />
            </Field>
            <Field
              label={t('form.title')}
              id="title"
              required
              error={errors.title?.message}
              className="form-title-field"
            >
              <Input
                {...attributes('title')}
                maxLength={200}
                required
                placeholder={t('form.titlePlaceholder')}
              />
            </Field>
            <Field
              label={t('form.price')}
              id="price"
              required
              error={errors.price?.message}
            >
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    id="price"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                    aria-invalid={Boolean(errors.price)}
                    aria-describedby={errors.price ? 'price-error' : undefined}
                    placeholder={formatPrice(0)}
                  />
                )}
              />
            </Field>
            <Field
              label={t('form.quantity')}
              id="quantity"
              required
              error={errors.quantity?.message}
            >
              <Input
                {...attributes('quantity')}
                required
                inputMode="numeric"
              />
            </Field>
            <Field
              label={t('form.type')}
              id="productType"
              required
              error={errors.productType?.message}
            >
              <Select
                {...attributes('productType')}
                required
              >
                <option
                  value=""
                >{t('form.selectType')}</option>
                {PRODUCT_TYPES.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {t(`types.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('form.description')}
              id="description"
              error={errors.description?.message}
              className="full-width"
            >
              <textarea
                {...attributes('description')}
                className="input textarea"
                maxLength={4000}
                rows={3}
                placeholder={t('form.descriptionPlaceholder')}
              />
            </Field>
            <div
              className="field full-width"
            >
              <label
                htmlFor="product-image"
              >
                {t('form.image')}{' '}
                <span
                  className="muted"
                >({t('common.optional')})</span>
              </label>
              <input
                ref={inputRef}
                type="file"
                id="product-image"
                className="sr-only"
                tabIndex={-1}
                accept="image/png,image/jpeg"
                aria-describedby="image-help"
                onChange={(event) => {
                  selectFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {imageSrc ? (
                <div
                  className="image-selection"
                >
                  <ProductImage
                    key={imageSrc}
                    src={imageSrc}
                    alt={t('form.imageAlt', {
                      title: savedProduct?.title || t('form.title'),
                    })}
                    className="image-preview"
                  />
                  <div>
                    <p
                      className="image-filename"
                    >{file?.name}</p>
                    <div
                      className="image-actions"
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => inputRef.current?.click()}
                      >
                        <Upload
                          size={15}
                        />
                        {t('common.replace')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setFile(null);
                          setRemoveImage(Boolean(savedProduct?.imageKey));
                          setImageError('');
                        }}
                      >
                        <X
                          size={15}
                        />
                        {t('common.remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="upload-area"
                  aria-describedby="image-help"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImagePlus
                    size={25}
                    strokeWidth={1.5}
                  />
                  <span>{t('form.imagePrompt')}</span>
                </button>
              )}
              <p
                id="image-help"
                className="field-hint"
              >
                {t('form.imageHelp')}
              </p>
              {removeImage && (
                <p
                  className="field-hint"
                >{t('form.imageRemove')}</p>
              )}
              {imageError && (
                <p
                  className="notice notice-error"
                  role="alert"
                >
                  {imageError}
                </p>
              )}
            </div>
          </fieldset>
          <div
            className="form-status"
          >
            <div>
              <strong>{t('form.status')}</strong>
              <StatusBadge
                status={
                  initialProduct?.status ?? savedProduct?.status ?? 'ACTIVE'
                }
              />
            </div>
            {initialProduct ? (
              <StatusAction
                product={initialProduct}
                disabled={dirty || mutation.isPending}
              />
            ) : (
              <p>{t('form.newStatus')}</p>
            )}
          </div>
          {initialProduct && (
            <p
              className="field-hint"
            >{t('form.statusHelp')}</p>
          )}
        </section>
        <div
          className="form-actions"
        >
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={exit}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            busy={mutation.isPending}
          >
            <Save
              size={16}
            />
            {t(mutation.isPending ? 'common.saving' : 'common.save')}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('form.unsaved')}
        description={t('form.unsavedDescription')}
        confirmLabel={t('form.discard')}
        onConfirm={() => router.push('/products')}
      />
    </>
  );
}
