'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getProductImageUrl, PRODUCT_IMAGES_BUCKET } from '@/lib/supabase'
import { Product } from '@/types/database'
import imageCompression from 'browser-image-compression'
import toast from 'react-hot-toast'

export default function InventoryPage() {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state for inventory items
  const [formData, setFormData] = useState({
    name: '',
    qty: '',
    cost: '',
    sellingPrice: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingItem, setDeletingItem] = useState<Product | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const resetForm = () => {
    setFormData({
      name: '',
      qty: '',
      cost: '',
      sellingPrice: '',
    })
    setImageFile(null)
    setImagePreview(null)
  }

  const openAddModal = () => {
    resetForm()
    setEditingItem(null)
    setShowAddModal(true)
  }

  const openEditModal = (item: Product) => {
    setFormData({
      name: item.name,
      qty: item.qty.toString(),
      cost: item.cost.toFixed(2),
      sellingPrice: item.selling_price.toFixed(2),
    })
    setImagePreview(item.image_url ? getProductImageUrl(item.image_url) : null)
    setImageFile(null)
    setEditingItem(item)
    setShowAddModal(true)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingItem(null)
    resetForm()
  }

  // Calculate profit
  const calculateProfit = (): number => {
    const cost = parseFloat(formData.cost) || 0
    const sellingPrice = parseFloat(formData.sellingPrice) || 0
    return sellingPrice - cost
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const options = {
        maxSizeMB: 0.15,
        maxWidthOrHeight: 100,
        useWebWorker: true,
      }

      const compressedFile = await imageCompression(file, options)
      setImageFile(compressedFile)

      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(compressedFile)
    } catch (error) {
      console.error('Error compressing image:', error)
      toast.error('Failed to process image')
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `inventory-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

      const { error } = await (supabase as any).storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        toast.error(`Upload failed: ${error.message}`)
        return null
      }
      
      return fileName
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast.error(`Upload error: ${error?.message || 'Unknown error'}`)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Please enter an item name')
      return
    }

    const qty = parseFloat(formData.qty) || 0
    if (qty < 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    const cost = parseFloat(formData.cost) || 0
    if (cost < 0) {
      toast.error('Please enter a valid cost')
      return
    }

    const sellingPrice = parseFloat(formData.sellingPrice) || 0
    if (sellingPrice <= 0) {
      toast.error('Please enter a valid selling price')
      return
    }

    setIsSubmitting(true)

    try {
      let imagePath = editingItem?.image_url || null

      if (imageFile) {
        const uploadedPath = await uploadImage(imageFile)
        if (uploadedPath) {
          if (editingItem?.image_url) {
            await (supabase as any).storage
              .from(PRODUCT_IMAGES_BUCKET)
              .remove([editingItem.image_url])
          }
          imagePath = uploadedPath
        }
      }

      const itemData: Record<string, any> = {
        name: formData.name,
        qty: qty,
        cost: cost,
        selling_price: sellingPrice,
        image_url: imagePath,
      }

      if (editingItem) {
        if (editingItem.image_url && imageFile) {
          await (supabase as any).storage
            .from(PRODUCT_IMAGES_BUCKET)
            .remove([editingItem.image_url])
        }

        const { error } = await (supabase as any)
          .from('products')
          .update(itemData)
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Item updated!')
      } else {
        const { error } = await (supabase as any)
          .from('products')
          .insert(itemData)

        if (error) throw error
        toast.success('Item added!')
      }

      closeModal()
      fetchItems()
    } catch (error) {
      console.error('Error saving item:', error)
      toast.error('Failed to save item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openDeleteConfirm = (item: Product) => {
    setDeletingItem(item)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    if (!deletingItem) return

    try {
      if (deletingItem.image_url) {
        await (supabase as any).storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([deletingItem.image_url])
      }

      const { error } = await (supabase as any)
        .from('products')
        .delete()
        .eq('id', deletingItem.id)

      if (error) throw error
      toast.success('Item deleted')
      setShowDeleteConfirm(false)
      setDeletingItem(null)
      closeModal()
      fetchItems()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  // Get total inventory value
  const getTotalInventoryValue = () => {
    return items.reduce((total, item) => total + (item.cost * item.qty), 0)
  }

  const profit = calculateProfit()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      {/* Header with Stats */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Inventory Overview</h2>
            <p className="text-surface-400 text-sm">
              {items.length} items • Total Value: ₱{getTotalInventoryValue().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="card p-8 text-center">
            <svg className="w-12 h-12 text-surface-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-surface-400">No inventory items yet. Add items to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => openEditModal(item)}
                className="card p-4 text-left hover:border-primary-500/50 transition-all group"
              >
                <div className="aspect-square bg-surface-800 rounded-lg mb-3 overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={getProductImageUrl(item.image_url) || ''}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>
                <h4 className="font-medium text-white text-sm truncate mb-1">{item.name}</h4>
                <p className="text-surface-400 text-xs mb-1">{item.qty} pcs in stock</p>
                <div className="flex items-center justify-between">
                  <span className="text-primary-500 font-bold text-sm">₱{item.selling_price.toFixed(2)}</span>
                  <span className="text-surface-500 text-xs">Cost: ₱{item.cost.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={closeModal} className="text-surface-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Item Image (optional)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video bg-surface-800 border-2 border-dashed border-surface-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-500/50 transition-colors overflow-hidden"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-8 h-8 text-surface-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-surface-500 text-sm">Click to upload</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white"
                  placeholder="e.g., Burger, Fries, Soda"
                  required
                />
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Stock Quantity (pieces)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.qty}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setFormData((prev) => ({ ...prev, qty: val }))
                    }
                  }}
                  className="w-full px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white font-mono"
                  placeholder="e.g., 100"
                  required
                />
              </div>

              {/* Cost per piece */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Cost per piece (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">₱</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.cost}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setFormData((prev) => ({ ...prev, cost: val }))
                      }
                    }}
                    className="w-full pl-8 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Selling Price (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">₱</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.sellingPrice}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setFormData((prev) => ({ ...prev, sellingPrice: val }))
                      }
                    }}
                    className="w-full pl-8 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Profit Preview */}
              <div className="p-4 bg-surface-800/50 rounded-lg border border-surface-700">
                <div className="flex justify-between items-center">
                  <span className="text-surface-400">Profit per piece:</span>
                  <span className={`font-mono font-bold text-lg ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ₱{profit.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
              </button>

              {editingItem && (
                <button
                  type="button"
                  onClick={() => openDeleteConfirm(editingItem)}
                  className="w-full py-2 text-red-400 hover:text-red-300 text-sm"
                >
                  Delete Item
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Item?</h3>
            <p className="text-surface-400 text-sm mb-4">
              Are you sure you want to delete <strong className="text-white">{deletingItem.name}</strong>?
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <p className="text-red-400 text-sm">
                ⚠️ This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingItem(null)
                }}
                className="flex-1 px-4 py-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
