'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, getProductImageUrl } from '@/lib/supabase'
import { Product, PaymentMethod, CustomerType } from '@/types/database'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface CartItem {
  product: Product
  quantity: number
}

export default function SalesPage() {
  const { user } = useAuth()
  const { addRecentSale } = useNotifications()
  const [products, setProducts] = useState<Product[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([])
  const [loading, setLoading] = useState(true)

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('')
  const [selectedDineInTakeout, setSelectedDineInTakeout] = useState<'dine_in' | 'takeout' | null>(null)
  const [customerPayment, setCustomerPayment] = useState<string>('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  // Product/Cart item modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null)
  const [modalQuantity, setModalQuantity] = useState<string>('1')

  const isOwner = user?.role === 'owner'

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, paymentRes, customerRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('payment_methods').select('*').order('name'),
        supabase.from('customer_types').select('*').order('name'),
      ])

      if (productsRes.data) setProducts(productsRes.data)
      if (paymentRes.data) setPaymentMethods(paymentRes.data)
      if (customerRes.data) setCustomerTypes(customerRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Check if product is out of stock
  const isProductOutOfStock = (product: Product): boolean => {
    return product.qty <= 0
  }

  // Get available quantity (considering cart)
  const getAvailableQuantity = (product: Product): number => {
    const cartItem = cart.find(item => item.product.id === product.id)
    const inCart = cartItem ? cartItem.quantity : 0
    return product.qty - inCart
  }

  // Cart calculations
  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.product.selling_price), 0)
  const paymentAmount = parseFloat(customerPayment) || 0
  const changeAmount = paymentAmount - cartTotal

  // Check if checkout is valid
  const canCheckout = cart.length > 0 && 
    selectedPaymentMethod && 
    selectedCustomerType && 
    selectedDineInTakeout && 
    paymentAmount >= cartTotal

  // Generate transaction number (YY-MM-XXXXX format, resets monthly)
  const generateTransactionNumber = async (): Promise<string> => {
    const now = new Date()
    const yearMonth = format(now, 'yy-MM')
    
    try {
      const { data } = await supabase
        .from('sales')
        .select('transaction_number')
        .like('transaction_number', `${yearMonth}-%`)
        .order('transaction_number', { ascending: false })
        .limit(1)

      let nextNum = 1
      if (data && data.length > 0 && data[0].transaction_number) {
        const lastNum = parseInt(data[0].transaction_number.split('-')[2]) || 0
        nextNum = lastNum + 1
      }

      return `${yearMonth}-${nextNum.toString().padStart(5, '0')}`
    } catch (error) {
      console.error('Error generating transaction number:', error)
      return `${yearMonth}-00001`
    }
  }

  // Open modal for product
  const handleProductClick = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id)
    if (existingItem) {
      setEditingCartItem(existingItem)
      setModalQuantity(existingItem.quantity.toString())
    } else {
      setSelectedProduct(product)
      setModalQuantity('1')
    }
  }

  // Open modal for cart item
  const handleCartItemClick = (item: CartItem) => {
    setEditingCartItem(item)
    setModalQuantity(item.quantity.toString())
  }

  const closeModal = () => {
    setSelectedProduct(null)
    setEditingCartItem(null)
    setModalQuantity('1')
  }

  // Handle quantity input change
  const handleQuantityChange = (value: string) => {
    if (value === '') {
      setModalQuantity('')
      return
    }
    const num = parseInt(value)
    if (!isNaN(num) && num >= 0) {
      setModalQuantity(num.toString())
    }
  }

  // Handle payment input change
  const handlePaymentChange = (value: string) => {
    if (value === '') {
      setCustomerPayment('')
      return
    }
    const regex = /^\d*\.?\d{0,2}$/
    if (regex.test(value)) {
      setCustomerPayment(value)
    }
  }

  // Get max quantity user can add
  const getMaxQuantity = (): number => {
    const product = editingCartItem?.product || selectedProduct
    if (!product) return 0
    
    if (editingCartItem) {
      // When editing, max is stock + current cart quantity
      return product.qty
    } else {
      // When adding new, max is available quantity
      return getAvailableQuantity(product)
    }
  }

  // Add or update cart
  const handleAddToCart = () => {
    const qty = parseInt(modalQuantity) || 0
    if (qty <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    const maxQty = getMaxQuantity()
    if (qty > maxQty) {
      toast.error(`Only ${maxQty} available in stock`)
      return
    }

    if (editingCartItem) {
      setCart(cart.map(item => 
        item.product.id === editingCartItem.product.id 
          ? { ...item, quantity: qty }
          : item
      ))
      toast.success('Cart updated')
    } else if (selectedProduct) {
      const existingIndex = cart.findIndex(item => item.product.id === selectedProduct.id)
      if (existingIndex >= 0) {
        const updatedCart = [...cart]
        const newQty = updatedCart[existingIndex].quantity + qty
        if (newQty > selectedProduct.qty) {
          toast.error(`Only ${selectedProduct.qty} available in stock`)
          return
        }
        updatedCart[existingIndex].quantity = newQty
        setCart(updatedCart)
      } else {
        setCart([...cart, { product: selectedProduct, quantity: qty }])
      }
      toast.success('Added to cart')
    }
    closeModal()
  }

  // Remove item from cart
  const handleRemoveFromCart = () => {
    if (editingCartItem) {
      setCart(cart.filter(item => item.product.id !== editingCartItem.product.id))
      toast.success('Removed from cart')
      closeModal()
    }
  }

  // Clear cart
  const clearCart = () => {
    setCart([])
    setSelectedPaymentMethod('')
    setSelectedCustomerType('')
    setSelectedDineInTakeout(null)
    setCustomerPayment('')
  }

  // Handle checkout
  const handleCheckout = async () => {
    if (!canCheckout) return

    setIsCheckingOut(true)

    try {
      const transactionId = crypto.randomUUID()
      const transactionNumber = await generateTransactionNumber()

      // Create sale records
      const saleRecords = cart.map(item => ({
        transaction_id: transactionId,
        transaction_number: transactionNumber,
        product_id: item.product.id,
        product_name: item.product.name,
        qty: item.quantity,
        cost: item.product.cost,
        selling_price: item.product.selling_price,
        total: item.quantity * item.product.selling_price,
        payment_method: selectedPaymentMethod,
        customer_type: selectedCustomerType,
        dine_in_takeout: selectedDineInTakeout,
        customer_payment: paymentAmount,
        earnings_datetime: new Date().toISOString(),
      }))
      
      const { data: saleData, error: saleError } = await (supabase as any)
        .from('sales')
        .insert(saleRecords)
        .select()

      if (saleError) {
        console.error('Sale insert error:', saleError)
        console.error('Sale records attempted:', saleRecords)
        toast.error(`Sale failed: ${saleError.message || 'Database error'}`)
        throw saleError
      }

      // Deduct from inventory
      for (const item of cart) {
        const newQty = Math.max(0, item.product.qty - item.quantity)
        
        const { error: updateError } = await (supabase as any)
          .from('products')
          .update({ qty: newQty })
          .eq('id', item.product.id)
        
        if (updateError) {
          console.error(`Failed to update inventory for ${item.product.name}:`, updateError)
        }
      }

      if (saleData && saleData.length > 0) {
        addRecentSale(saleData[0])
      }

      toast.success(`Sale completed! Transaction: ${transactionNumber}`)
      clearCart()
      fetchData()
    } catch (error) {
      console.error('Error processing sale:', error)
      toast.error('Failed to process sale')
    } finally {
      setIsCheckingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Filter products that have stock
  const availableProducts = products.filter(p => p.qty > 0 || cart.some(c => c.product.id === p.id))
  const outOfStockProducts = products.filter(p => p.qty <= 0 && !cart.some(c => c.product.id === p.id))

  const currentProduct = editingCartItem?.product || selectedProduct

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      {/* Top Section - Cart & Checkout */}
      <div className="card p-4 mb-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">
            Cart {cart.length > 0 && `(${cart.reduce((sum, i) => sum + i.quantity, 0)} items)`}
          </h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-300">
              Clear Cart
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="min-h-[60px] max-h-32 overflow-y-auto mb-4 p-2 bg-surface-800/50 rounded-lg">
          {cart.length === 0 ? (
            <p className="text-surface-500 text-sm text-center py-4">No items in cart</p>
          ) : (
            <div className="space-y-1">
              {cart.map((item) => (
                <button
                  key={item.product.id}
                  onClick={() => handleCartItemClick(item)}
                  className="w-full flex items-center justify-between p-2 hover:bg-surface-700/50 rounded transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">{item.product.name}</span>
                    <span className="text-surface-500 text-xs">@ ₱{item.product.selling_price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-surface-400 text-sm">{item.quantity} pcs</span>
                    <span className="text-primary-500 font-mono text-sm">₱{(item.quantity * item.product.selling_price).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selection Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Customer Type */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Customer Type</label>
            <div className="flex flex-wrap gap-1">
              {customerTypes.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setSelectedCustomerType(ct.name)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    selectedCustomerType === ct.name
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-900'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: ct.color, color: '#fff' }}
                >
                  {ct.name}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Payment Method</label>
            <div className="flex flex-wrap gap-1">
              {paymentMethods.map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setSelectedPaymentMethod(pm.name)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    selectedPaymentMethod === pm.name
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-900'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: pm.color, color: '#fff' }}
                >
                  {pm.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dine In / Takeout */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Order Type</label>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedDineInTakeout('dine_in')}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  selectedDineInTakeout === 'dine_in'
                    ? 'bg-blue-500 text-white'
                    : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                }`}
              >
                Dine In
              </button>
              <button
                onClick={() => setSelectedDineInTakeout('takeout')}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  selectedDineInTakeout === 'takeout'
                    ? 'bg-green-500 text-white'
                    : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                }`}
              >
                Takeout
              </button>
            </div>
          </div>
        </div>

        {/* Payment Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          {/* Payment Input */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Payment</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">₱</span>
              <input
                type="text"
                inputMode="decimal"
                value={customerPayment}
                onChange={(e) => handlePaymentChange(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white font-mono text-right"
              />
            </div>
          </div>

          {/* Total Display */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Total</label>
            <div className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-primary-500 font-mono font-bold text-right">
              ₱{cartTotal.toFixed(2)}
            </div>
          </div>

          {/* Change Display */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Change</label>
            <div className={`px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg font-mono font-bold text-right ${
              changeAmount >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              ₱{changeAmount.toFixed(2)}
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={!canCheckout || isCheckingOut}
            className="py-2 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCheckingOut ? 'Processing...' : 'Checkout'}
          </button>
        </div>
      </div>

      {/* Bottom Section - Products Grid */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-3">Products</h3>
        {products.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-surface-400">No products available. Add products in the Inventory section.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {availableProducts.map((product) => {
              const available = getAvailableQuantity(product)
              const inCart = cart.find(c => c.product.id === product.id)
              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`card p-3 text-left transition-all group ${
                    inCart ? 'border-primary-500/50 bg-primary-500/5' : 'hover:border-primary-500/50'
                  }`}
                >
                  <div className="aspect-square bg-surface-800 rounded-lg mb-2 overflow-hidden relative">
                    {product.image_url ? (
                      <img
                        src={getProductImageUrl(product.image_url) || ''}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    {inCart && (
                      <div className="absolute top-1 right-1 bg-primary-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                        {inCart.quantity}
                      </div>
                    )}
                  </div>
                  <h4 className="font-medium text-xs truncate text-white">{product.name}</h4>
                  <p className="text-surface-400 text-xs">{available} pcs left</p>
                  <p className="text-primary-500 font-bold text-sm">₱{product.selling_price.toFixed(2)}</p>
                </button>
              )
            })}
            {outOfStockProducts.map((product) => (
              <button
                key={product.id}
                disabled
                className="card p-3 text-left opacity-40 cursor-not-allowed grayscale"
              >
                <div className="aspect-square bg-surface-800 rounded-lg mb-2 overflow-hidden relative">
                  {product.image_url ? (
                    <img
                      src={getProductImageUrl(product.image_url) || ''}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-xs font-medium text-red-400 bg-red-500/20 px-2 py-1 rounded">
                      Out of Stock
                    </span>
                  </div>
                </div>
                <h4 className="font-medium text-xs truncate text-surface-500">{product.name}</h4>
                <p className="text-surface-600 text-xs">0 pcs left</p>
                <p className="text-surface-600 font-bold text-sm">₱{product.selling_price.toFixed(2)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product/Cart Item Modal */}
      {currentProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-surface-800 rounded-lg overflow-hidden flex-shrink-0">
                  {currentProduct.image_url ? (
                    <img
                      src={getProductImageUrl(currentProduct.image_url) || ''}
                      alt={currentProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{currentProduct.name}</h3>
                  <p className="text-primary-500 font-bold">₱{currentProduct.selling_price.toFixed(2)}</p>
                  <p className="text-surface-400 text-xs">{getMaxQuantity()} pcs available</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-surface-400 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quantity Controls */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-300 mb-2">Quantity</label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => handleQuantityChange(Math.max(1, (parseInt(modalQuantity) || 0) - 1).toString())}
                  className="w-14 h-14 flex-shrink-0 rounded-lg bg-surface-700 hover:bg-surface-600 text-white flex items-center justify-center text-2xl font-bold border border-surface-600 transition-colors"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalQuantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-24 px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg text-white text-center font-mono text-xl"
                />
                <button
                  onClick={() => handleQuantityChange(Math.min(getMaxQuantity(), (parseInt(modalQuantity) || 0) + 1).toString())}
                  className="w-14 h-14 flex-shrink-0 rounded-lg bg-surface-700 hover:bg-surface-600 text-white flex items-center justify-center text-2xl font-bold border border-surface-600 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Subtotal */}
            <div className="flex items-center justify-between mb-4 p-3 bg-surface-800/50 rounded-lg">
              <span className="text-surface-400">Subtotal</span>
              <span className="text-xl font-bold text-primary-500">
                ₱{((parseInt(modalQuantity) || 0) * currentProduct.selling_price).toFixed(2)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {editingCartItem && (
                <button
                  onClick={handleRemoveFromCart}
                  className="flex-1 py-3 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg transition-colors"
                >
                  Remove
                </button>
              )}
              <button
                onClick={handleAddToCart}
                disabled={(parseInt(modalQuantity) || 0) <= 0 || (parseInt(modalQuantity) || 0) > getMaxQuantity()}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {editingCartItem ? 'Update Cart' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
