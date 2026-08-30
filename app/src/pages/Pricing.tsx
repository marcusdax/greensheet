import Layout, { PageHeader } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCentsPerLb } from "@contracts/constants";

export default function Pricing() {
  const { data: lots } = trpc.catalog.list.useQuery();
  const active = lots?.filter((l) => l.status === "active") ?? [];

  return (
    <Layout>
      <PageHeader
        title="Pricing Sheet"
        sub="Current spot pricing on active verified lots — full tier pricing coming soon"
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active lots</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active lots on the sheet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Cup score</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Spot lbs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.region} · {l.origin}</TableCell>
                    <TableCell><Badge variant="outline">{l.cupScore.toFixed(1)} SCA</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCentsPerLb(l.pricePerLbCents)}</TableCell>
                    <TableCell className="text-right">{l.availableLbs.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
