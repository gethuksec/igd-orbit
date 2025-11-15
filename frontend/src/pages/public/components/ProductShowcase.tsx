import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicService, FeaturedProduct } from '@/services/public.service';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Eye, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProductShowcaseProps {
  limit?: number;
  showViewAll?: boolean;
}

export default function ProductShowcase({ limit = 8, showViewAll = true }: ProductShowcaseProps) {
  const [selectedProduct, setSelectedProduct] = useState<FeaturedProduct | null>(null);

  const { data: products, isLoading } = useQuery<FeaturedProduct[]>({
    queryKey: ['featuredProducts', limit],
    queryFn: () => publicService.getFeaturedProducts(limit),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-64" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No products available at the moment.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group"
          >
            {/* Product Image */}
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0] as string}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ShoppingCart className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity" />
            </div>

            {/* Product Info */}
            <div className="p-4">
              {product.brand && (
                <Badge variant="outline" className="mb-2">
                  {product.brand.name}
                </Badge>
              )}
              <h3 className="font-semibold text-lg mb-2 line-clamp-2">{product.name}</h3>
              {product.category && (
                <p className="text-sm text-gray-500 mb-2">{product.category.name}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(product.sellingPrice)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSelectedProduct(product)}
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick View Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                >
                  ×
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  {selectedProduct.images && selectedProduct.images.length > 0 ? (
                    <img
                      src={selectedProduct.images[0] as string}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingCart className="w-24 h-24 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">SKU</p>
                      <p className="font-medium">{selectedProduct.sku}</p>
                    </div>
                    {selectedProduct.brand && (
                      <div>
                        <p className="text-sm text-gray-500">Brand</p>
                        <p className="font-medium">{selectedProduct.brand.name}</p>
                      </div>
                    )}
                    {selectedProduct.category && (
                      <div>
                        <p className="text-sm text-gray-500">Category</p>
                        <p className="font-medium">{selectedProduct.category.name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Price</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(selectedProduct.sellingPrice)}
                      </p>
                    </div>
                    <Button className="w-full" onClick={() => window.open(`https://wa.me/6281234567890?text=Hi, I'm interested in ${selectedProduct.name} (${selectedProduct.sku})`, '_blank')}>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Contact to Order
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewAll && (
        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => window.location.href = '/products'}>
            View All Products
          </Button>
        </div>
      )}
    </>
  );
}

